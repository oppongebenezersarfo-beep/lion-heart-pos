import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    if (search) { query += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY name ASC';
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, credit_limit, credit_terms_days, is_credit_approved } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required.' });
    const id = crypto.randomUUID();
    pool.query('INSERT INTO customers (id, name, phone, email, address, credit_limit, credit_terms_days, is_credit_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, phone || null, email || null, address || null, credit_limit || 0, credit_terms_days || 30, is_credit_approved ? 1 : 0]);
    res.status(201).json(pool.query('SELECT * FROM customers WHERE id = ?', [id]).rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, credit_limit, credit_terms_days, is_credit_approved } = req.body;
    // Build dynamic update - only update fields that are provided
    const fields: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (address !== undefined) { fields.push('address = ?'); params.push(address); }
    if (credit_limit !== undefined) { fields.push('credit_limit = ?'); params.push(credit_limit); }
    if (credit_terms_days !== undefined) { fields.push('credit_terms_days = ?'); params.push(credit_terms_days); }
    if (is_credit_approved !== undefined) { fields.push('is_credit_approved = ?'); params.push(is_credit_approved ? 1 : 0); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, params);
    const result = pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/:id/sales', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query('SELECT s.*, u.full_name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.customer_id = ? ORDER BY s.created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/:id/payments', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid payment amount.' });
    const customer = pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    if (customer.rows[0].outstanding_balance < amount) return res.status(400).json({ error: 'Payment exceeds outstanding balance.' });
    pool.query('UPDATE customers SET outstanding_balance = outstanding_balance - ? WHERE id = ?', [amount, id]);
    pool.query('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      [req.user!.id, 'customer_payment', JSON.stringify({ customerId: id, amount, paymentMethod: payment_method, notes })]);
    res.json({ message: 'Payment recorded.', newBalance: customer.rows[0].outstanding_balance - amount });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    const sales = pool.query('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?', [id]);
    if (sales.rows[0].count > 0) return res.status(400).json({ error: 'Cannot delete customer with sales history.' });
    pool.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ message: 'Customer deleted.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
