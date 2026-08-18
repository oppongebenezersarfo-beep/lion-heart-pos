import { Router, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { logAudit } from '../utils/audit';

const router = Router();

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PO-${date}-${random}`;
}

router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let query = `SELECT po.*, s.name as supplier_name, u.full_name as created_by_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN users u ON po.created_by = u.id WHERE 1=1`;
    const params: any[] = [];
    if (status) { query += ' AND po.status = ?'; params.push(status); }
    query += ' ORDER BY po.created_at DESC';
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const poResult = pool.query(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?`, [req.params.id]);
    if (poResult.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    const itemsResult = pool.query(`SELECT pi.*, p.name as product_name, p.sku FROM purchase_items pi LEFT JOIN products p ON pi.product_id = p.id WHERE pi.purchase_order_id = ?`, [req.params.id]);
    res.json({ ...poResult.rows[0], items: itemsResult.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_id, items } = req.body;
    if (!supplier_id || !items || items.length === 0) return res.status(400).json({ error: 'Supplier and items are required.' });
    const order_number = generateOrderNumber();
    let total = 0;
    for (const item of items) total += item.quantity * item.unit_cost;
    const poId = crypto.randomUUID();
    pool.query('INSERT INTO purchase_orders (id, order_number, supplier_id, total, created_by) VALUES (?, ?, ?, ?, ?)',
      [poId, order_number, supplier_id, total, req.user!.id]);
    for (const item of items) {
      pool.query('INSERT INTO purchase_items (id, purchase_order_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), poId, item.product_id, item.quantity, item.unit_cost]);
    }
    logAudit({ userId: req.user!.id, action: 'purchase_order_created', details: { purchaseOrderId: poId, order_number, supplier_id, total, itemCount: items.length } });
    res.status(201).json(pool.query('SELECT * FROM purchase_orders WHERE id = ?', [poId]).rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/:id/receive', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { received_items } = req.body;
    const poResult = pool.query("SELECT * FROM purchase_orders WHERE id = ? AND status = 'pending'", [id]);
    if (poResult.rows.length === 0) return res.status(404).json({ error: 'Pending purchase order not found.' });
    for (const item of received_items) {
      pool.query('UPDATE purchase_items SET received_quantity = ? WHERE id = ?', [item.received_quantity, item.id]);
      pool.query('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [item.received_quantity, item.product_id]);
      pool.query('INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_id, created_by) VALUES (?, ?, \'purchase\', ?, ?, ?)',
        [crypto.randomUUID(), item.product_id, item.received_quantity, id, req.user!.id]);
    }
    pool.query("UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?", [id]);
    logAudit({ userId: req.user!.id, action: 'purchase_received', details: { purchaseOrderId: id, receivedItems: received_items.length } });
    res.json({ message: 'Goods received and stock updated.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
