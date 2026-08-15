import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

function generateReference(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `LHH-${timestamp}-${random}`;
}

function verifyPaystackSignature(req: Request): boolean {
  const signature = req.headers['x-paystack-signature'] as string;
  if (!signature) return false;

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

// Initiate mobile money payment
router.post('/initiate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { email, amount, phone, provider, pin, sale_id } = req.body;

    if (!email || !amount || !phone || !provider) {
      return res.status(400).json({ error: 'email, amount, phone, and provider are required.' });
    }

    const validProviders = ['mtn', 'vod', 'atl'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Use mtn, vod (Telecel), or atl (AirtelTigo).' });
    }

    const amountInPesewas = Math.round(parseFloat(amount) * 100);

    if (isNaN(amountInPesewas) || amountInPesewas <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const reference = generateReference();

    // If PIN is provided, this is a follow-up submit_pin call
    if (pin) {
      try {
        const submitPinResponse = await paystackApi.post(`/charge/${reference}/submit_pin`, {
          pin,
          reference,
        });

        const { data } = submitPinResponse.data;

        pool.query(
          `UPDATE transactions SET paystack_response = ?, updated_at = datetime('now') WHERE reference = ?`,
          [JSON.stringify(data), reference]
        );

        return res.status(200).json({
          reference,
          status: data.status || 'pending',
          display_text: data.display_text || 'Processing payment...',
          gateway_response: data.gateway_response,
        });
      } catch (pinError: any) {
        console.error('Paystack submit_pin error:', pinError.response?.data || pinError.message);
        return res.status(400).json({
          error: pinError.response?.data?.message || 'Failed to submit PIN',
        });
      }
    }

    // Create pending transaction in database
    pool.query(
      `INSERT INTO transactions (id, reference, email, phone, provider, amount, status, sale_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [crypto.randomUUID(), reference, email, phone, provider, amountInPesewas, sale_id || null]
    );

    // Call Paystack Charge API
    const chargeResponse = await paystackApi.post('/charge', {
      email,
      amount: amountInPesewas,
      currency: 'GHS',
      mobile_money: {
        phone,
        provider,
      },
      reference,
      metadata: {
        custom_fields: [
          {
            display_name: 'Sale ID',
            variable_name: 'sale_id',
            value: sale_id || '',
          },
        ],
      },
    });

    const { data } = chargeResponse.data;

    console.log(`Paystack charge response for ${reference}:`, JSON.stringify({
      status: data.status,
      display_text: data.display_text,
      gateway_response: data.gateway_response,
    }));

    // Update transaction with initial response
    pool.query(
      `UPDATE transactions SET paystack_response = ?, updated_at = datetime('now') WHERE reference = ?`,
      [JSON.stringify(data), reference]
    );

    // If charge succeeded immediately (rare for MoMo)
    if (data.status === 'success') {
      pool.query(
        `UPDATE transactions SET status = 'success', updated_at = datetime('now') WHERE reference = ?`,
        [reference]
      );
    }

    res.status(201).json({
      reference,
      status: data.status || 'pending',
      display_text: data.display_text || data.gateway_response || 'Check your phone for the payment prompt',
      authorization_url: data.authorization_url || null,
    });
  } catch (error: any) {
    console.error('Paystack initiate error:', error.response?.data || error.message);

    const paystackError = error.response?.data;
    if (paystackError) {
      const message = paystackError.message || paystackError.data?.message || 'Payment initiation failed';
      return res.status(400).json({ error: message });
    }

    res.status(500).json({ error: 'Failed to initiate payment. Please try again.' });
  }
});

// Webhook endpoint — raw body must be parsed separately (see index.ts)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify signature
    if (!verifyPaystackSignature(req)) {
      console.error('Paystack webhook: Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body as any;

    if (!event || !event.event) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    const { event: eventType, data } = event;

    console.log(`Paystack webhook: ${eventType} for ${data?.reference || 'unknown'}`);

    if (eventType === 'charge.success') {
      const reference = data?.reference;
      if (!reference) return res.status(200).json({ ok: true });

      const existing = pool.query('SELECT status FROM transactions WHERE reference = ?', [reference]);
      if (existing.rows.length > 0 && existing.rows[0].status === 'success') {
        return res.status(200).json({ ok: true });
      }

      pool.query(
        `UPDATE transactions
         SET status = 'success', paystack_response = ?, updated_at = datetime('now')
         WHERE reference = ? AND status != 'success'`,
        [JSON.stringify(data), reference]
      );

      const tx = pool.query('SELECT sale_id FROM transactions WHERE reference = ?', [reference]);
      if (tx.rows.length > 0 && tx.rows[0].sale_id) {
        pool.query(
          `UPDATE sales SET payment_method = 'mtn_momo', status = 'completed', updated_at = datetime('now')
           WHERE id = ? AND status != 'completed'`,
          [tx.rows[0].sale_id]
        );
      }

      console.log(`Paystack webhook: charge.success for ${reference}`);
    } else if (eventType === 'charge.failed') {
      const reference = data?.reference;
      if (!reference) return res.status(200).json({ ok: true });

      pool.query(
        `UPDATE transactions
         SET status = 'failed', paystack_response = ?, updated_at = datetime('now')
         WHERE reference = ? AND status = 'pending'`,
        [JSON.stringify(data), reference]
      );

      console.log(`Paystack webhook: charge.failed for ${reference}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(200).json({ ok: true });
  }
});

// Verify transaction (fallback polling endpoint)
router.get('/verify/:reference', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: 'Reference is required.' });
    }

    const localTx = pool.query('SELECT * FROM transactions WHERE reference = ?', [reference]);
    if (localTx.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const tx = localTx.rows[0];

    // If already resolved, return local status
    if (tx.status === 'success' || tx.status === 'failed') {
      return res.json({
        reference: tx.reference,
        status: tx.status,
        amount: tx.amount / 100,
        email: tx.email,
        phone: tx.phone,
        provider: tx.provider,
        created_at: tx.created_at,
      });
    }

    // Otherwise, verify with Paystack
    const verifyResponse = await paystackApi.get(`/transaction/verify/${reference}`);
    const { data } = verifyResponse.data;

    console.log(`Paystack verify ${reference}: status=${data.status}, gateway=${data.gateway_response}`);

    if (data.status === 'success') {
      pool.query(
        `UPDATE transactions
         SET status = 'success', paystack_response = ?, updated_at = datetime('now')
         WHERE reference = ? AND status != 'success'`,
        [JSON.stringify(data), reference]
      );

      if (tx.sale_id) {
        pool.query(
          `UPDATE sales SET payment_method = 'mtn_momo', status = 'completed', updated_at = datetime('now')
           WHERE id = ? AND status != 'completed'`,
          [tx.sale_id]
        );
      }
    } else if (data.status === 'failed') {
      pool.query(
        `UPDATE transactions
         SET status = 'failed', paystack_response = ?, updated_at = datetime('now')
         WHERE reference = ? AND status = 'pending'`,
        [JSON.stringify(data), reference]
      );
    }

    res.json({
      reference,
      status: data.status,
      amount: data.amount / 100,
      email: data.customer?.email,
      phone: data.metadata?.phone,
      provider: tx.provider,
      gateway_response: data.gateway_response,
      display_text: data.gateway_response,
      created_at: data.created_at,
    });
  } catch (error: any) {
    console.error('Paystack verify error:', error.response?.data || error.message);

    const paystackError = error.response?.data;
    if (paystackError) {
      return res.status(400).json({ error: paystackError.message || 'Verification failed' });
    }

    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

export default router;
