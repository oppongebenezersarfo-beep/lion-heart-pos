import { Router, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

function generateInvoiceNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LHH-${date}-${random}`;
}

// ==================== HELD SALES (must be before /:id) ====================

// Hold sale
router.post('/hold', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sale_data } = req.body;
    const id = crypto.randomUUID();
    pool.query(
      'INSERT INTO held_sales (id, sale_data, cashier_id) VALUES (?, ?, ?)',
      [id, JSON.stringify(sale_data), req.user!.id]
    );
    const result = pool.query('SELECT * FROM held_sales WHERE id = ?', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Hold sale error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get held sales
router.get('/held/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query(
      'SELECT * FROM held_sales WHERE cashier_id = ? ORDER BY created_at DESC', [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get held sales error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete held sale
router.delete('/held/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    pool.query('DELETE FROM held_sales WHERE id = ? AND cashier_id = ?', [id, req.user!.id]);
    res.json({ message: 'Held sale removed.' });
  } catch (error) {
    console.error('Delete held sale error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==================== SALES CRUD ====================

// Create sale (with stock validation + transaction)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      items, subtotal, discount_amount, total, payment_method,
      payment_details, customer_id, is_offline_sale, offline_queue_id
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Sale must have at least one item.' });
    }

    // Validate stock availability first
    for (const item of items) {
      const stockResult = pool.query('SELECT current_stock, name FROM products WHERE id = ?', [item.product_id]);
      if (stockResult.rows.length === 0) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const currentStock = parseFloat(stockResult.rows[0].current_stock);
      if (currentStock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${stockResult.rows[0].name}". Available: ${currentStock}, Requested: ${item.quantity}`
        });
      }
    }

    // Validate discount requires manager (any discount needs PIN - checked on frontend)
    // Validate sale price not below cost without override (checked on frontend)

    // Execute all in a transaction
    const result = pool.transaction(() => {
      const invoice_number = generateInvoiceNumber();
      const saleId = crypto.randomUUID();

      pool.query(
        `INSERT INTO sales (id, invoice_number, cashier_id, customer_id, subtotal, discount_amount,
         total, payment_method, payment_details, status, is_offline_sale, offline_queue_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, invoice_number, req.user!.id, customer_id || null, subtotal, discount_amount || 0,
         total, payment_method, JSON.stringify(payment_details || {}),
         is_offline_sale ? 'synced' : 'completed', is_offline_sale ? 1 : 0, offline_queue_id || null]
      );

      for (const item of items) {
        const itemId = crypto.randomUUID();
        pool.query(
          `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, saleId, item.product_id, item.quantity, item.unit_price, item.discount || 0, item.total]
        );

        pool.query(
          'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );

        pool.query(
          `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_id, created_by)
           VALUES (?, ?, 'sale', ?, ?, ?)`,
          [crypto.randomUUID(), item.product_id, -item.quantity, saleId, req.user!.id]
        );
      }

      if (customer_id && payment_method === 'credit') {
        pool.query(
          'UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?',
          [total, customer_id]
        );
      }

      pool.query(
        'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
        [req.user!.id, 'sale_created', JSON.stringify({
          saleId, invoiceNumber: invoice_number, total, paymentMethod: payment_method, isOffline: is_offline_sale
        })]
      );

      return { saleId, invoice_number };
    });

    const saleResult = pool.query('SELECT * FROM sales WHERE id = ?', [result.saleId]);
    res.status(201).json({ ...saleResult.rows[0], items });
  } catch (error: any) {
    console.error('Create sale error:', error);
    if (error.message?.includes('CHECK constraint')) {
      return res.status(400).json({ error: 'Insufficient stock or invalid data.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get all sales
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, cashier_id, status, invoice_number } = req.query;

    let query = `
      SELECT s.*, u.full_name as cashier_name, c.name as customer_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) { query += ` AND s.created_at >= ?`; params.push(start_date); }
    if (end_date) { query += ` AND s.created_at <= ?`; params.push(end_date); }
    if (cashier_id) { query += ` AND s.cashier_id = ?`; params.push(cashier_id); }
    if (status) { query += ` AND s.status = ?`; params.push(status); }
    if (invoice_number) { query += ` AND s.invoice_number = ?`; params.push(invoice_number); }

    query += ' ORDER BY s.created_at DESC';

    const result = pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get sale by ID with items
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const saleResult = pool.query(
      `SELECT s.*, u.full_name as cashier_name, c.name as customer_name
       FROM sales s LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?`, [id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found.' });
    }

    const itemsResult = pool.query(
      `SELECT si.*, p.name as product_name, p.sku
       FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`, [id]
    );

    res.json({ ...saleResult.rows[0], items: itemsResult.rows });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Process return (with transaction)
router.post('/:id/return', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { items, reason } = req.body;

    const saleResult = pool.query('SELECT * FROM sales WHERE id = ?', [id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found.' });
    }

    const sale = saleResult.rows[0];
    const saleDate = new Date(sale.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      return res.status(400).json({ error: 'Return window (7 days) has expired.' });
    }

    const result = pool.transaction(() => {
      let refundTotal = 0;
      for (const item of items) {
        pool.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        pool.query(
          `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_id, notes, created_by)
           VALUES (?, ?, 'return', ?, ?, ?, ?)`,
          [crypto.randomUUID(), item.product_id, item.quantity, id, reason || 'Customer return', req.user!.id]
        );
        refundTotal += item.quantity * item.unit_price;
      }

      pool.query("UPDATE sales SET status = 'returned' WHERE id = ?", [id]);
      pool.query(
        'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
        [req.user!.id, 'sale_returned', JSON.stringify({ saleId: id, refundTotal, reason })]
      );

      return refundTotal;
    });

    res.json({ message: 'Return processed.', refundTotal: result });
  } catch (error) {
    console.error('Process return error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
