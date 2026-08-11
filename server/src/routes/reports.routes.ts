import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.get('/dashboard', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const salesToday = pool.query(`SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM sales WHERE date(created_at) = ? AND status = 'completed'`, [today]);
    const salesWeek = pool.query(`SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM sales WHERE created_at >= date('now', '-7 days') AND status = 'completed'`);
    const salesMonth = pool.query(`SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM sales WHERE created_at >= date('now', 'start of month') AND status = 'completed'`);
    const lowStock = pool.query(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.current_stock <= p.reorder_level AND p.is_active = 1 ORDER BY p.current_stock ASC LIMIT 10`);
    const topProducts = pool.query(`SELECT p.name, p.sku, SUM(si.quantity) as total_sold, SUM(si.total) as revenue FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id WHERE s.created_at >= date('now', 'start of month') AND s.status = 'completed' GROUP BY p.id, p.name, p.sku ORDER BY total_sold DESC LIMIT 10`);
    const recentSales = pool.query(`SELECT s.*, u.full_name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.status = 'completed' ORDER BY s.created_at DESC LIMIT 10`);

    res.json({
      salesToday: salesToday.rows[0], salesWeek: salesWeek.rows[0], salesMonth: salesMonth.rows[0],
      lowStock: lowStock.rows, topProducts: topProducts.rows, recentSales: recentSales.rows,
    });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/sales', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    let query: string;
    const params: any[] = [];

    if (group_by === 'day') {
      query = `SELECT date(created_at) as date, SUM(total) as revenue, COUNT(*) as transaction_count FROM sales WHERE status = 'completed'`;
      if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND created_at <= ?'; params.push(end_date); }
      query += ' GROUP BY date(created_at) ORDER BY date DESC';
    } else if (group_by === 'cashier') {
      query = `SELECT u.full_name as cashier_name, SUM(s.total) as revenue, COUNT(*) as transaction_count FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.status = 'completed'`;
      if (start_date) { query += ' AND s.created_at >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND s.created_at <= ?'; params.push(end_date); }
      query += ' GROUP BY u.id, u.full_name ORDER BY revenue DESC';
    } else {
      query = `SELECT SUM(total) as total_revenue, COUNT(*) as total_transactions, AVG(total) as average_sale FROM sales WHERE status = 'completed'`;
      if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
      if (end_date) { query += ' AND created_at <= ?'; params.push(end_date); }
    }
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/profit', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `SELECT p.name, p.sku, p.cost_price, p.selling_price, SUM(si.quantity) as total_sold, SUM(si.total) as revenue, SUM(si.quantity * p.cost_price) as total_cost, SUM(si.total - (si.quantity * p.cost_price)) as profit, ROUND(((p.selling_price - p.cost_price) / MAX(p.selling_price, 0.01)) * 100, 2) as margin_pct FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id WHERE s.status = 'completed'`;
    const params: any[] = [];
    if (start_date) { query += ' AND s.created_at >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND s.created_at <= ?'; params.push(end_date); }
    query += ' GROUP BY p.id, p.name, p.sku, p.cost_price, p.selling_price ORDER BY profit DESC';
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/low-stock', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    res.json(pool.query(`SELECT p.*, c.name as category_name, s.name as supplier_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.current_stock <= p.reorder_level AND p.is_active = 1 ORDER BY p.current_stock ASC`).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/offline-sync', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    res.json(pool.query(`SELECT s.*, u.full_name as cashier_name FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.is_offline_sale = 1 ORDER BY s.synced_at DESC`).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
