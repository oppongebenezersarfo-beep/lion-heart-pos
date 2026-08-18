import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, action, start_date, end_date, page = '1', limit = '50' } = req.query;

    let query = `
      SELECT al.*, u.username, u.full_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND al.action = ?'; params.push(action); }
    if (start_date) { query += ' AND al.created_at >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND al.created_at <= ?'; params.push(end_date); }

    // Count total
    const countQuery = query.replace('SELECT al.*, u.username, u.full_name', 'SELECT COUNT(*) as total');
    const countResult = pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    // Paginate
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const result = pool.query(query, params);

    // Get distinct actions for filter dropdown
    const actions = pool.query('SELECT DISTINCT action FROM audit_log ORDER BY action').rows;

    res.json({
      logs: result.rows,
      actions: actions.map((a: any) => a.action),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
