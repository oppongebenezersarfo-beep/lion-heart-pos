import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { opening_cash } = req.body;
    const existing = pool.query("SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open'", [req.user!.id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'You already have an open shift.' });
    const id = crypto.randomUUID();
    pool.query('INSERT INTO shifts (id, cashier_id, opening_cash, status) VALUES (?, ?, ?, \'open\')', [id, req.user!.id, opening_cash || 0]);
    res.status(201).json(pool.query('SELECT * FROM shifts WHERE id = ?', [id]).rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/current', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shiftResult = pool.query("SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1", [req.user!.id]);
    if (shiftResult.rows.length === 0) return res.json(null);
    const shift = shiftResult.rows[0];
    const salesSummary = pool.query(`SELECT SUM(total) as total_sales, COUNT(*) as transaction_count FROM sales WHERE cashier_id = ? AND created_at >= ? AND status = 'completed'`, [req.user!.id, shift.start_time]);
    const paymentBreakdown = pool.query(`SELECT payment_method, SUM(total) as amount FROM sales WHERE cashier_id = ? AND created_at >= ? AND status = 'completed' GROUP BY payment_method`, [req.user!.id, shift.start_time]);
    res.json({ ...shift, sales_summary: salesSummary.rows[0], payment_breakdown: paymentBreakdown.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/:id/close', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { closing_cash } = req.body;
    const shiftResult = pool.query("SELECT * FROM shifts WHERE id = ? AND cashier_id = ? AND status = 'open'", [id, req.user!.id]);
    if (shiftResult.rows.length === 0) return res.status(404).json({ error: 'Open shift not found.' });
    const shift = shiftResult.rows[0];
    const cashSales = pool.query(`SELECT COALESCE(SUM(total), 0) as cash_total FROM sales WHERE cashier_id = ? AND created_at >= ? AND payment_method = 'cash' AND status = 'completed'`, [req.user!.id, shift.start_time]);
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(cashSales.rows[0].cash_total);
    const difference = parseFloat(closing_cash) - expectedCash;
    pool.query('UPDATE shifts SET end_time=datetime(\'now\'), closing_cash=?, expected_cash=?, difference=?, status=\'closed\' WHERE id=?', [closing_cash, expectedCash, difference, id]);
    pool.query('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)', [req.user!.id, 'shift_closed', JSON.stringify({ shiftId: id, openingCash: shift.opening_cash, closingCash: closing_cash, expectedCash, difference })]);
    res.json(pool.query('SELECT * FROM shifts WHERE id = ?', [id]).rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/history', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { cashier_id, start_date, end_date } = req.query;
    let query = 'SELECT s.*, u.full_name as cashier_name FROM shifts s LEFT JOIN users u ON s.cashier_id = u.id WHERE 1=1';
    const params: any[] = [];
    if (cashier_id) { query += ' AND s.cashier_id = ?'; params.push(cashier_id); }
    if (start_date) { query += ' AND s.start_time >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND s.start_time <= ?'; params.push(end_date); }
    query += ' ORDER BY s.start_time DESC';
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
