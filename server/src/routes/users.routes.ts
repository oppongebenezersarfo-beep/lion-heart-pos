import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { logAudit } from '../utils/audit';

const router = Router();

router.get('/', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    res.json(pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY full_name').rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, full_name, role, pin } = req.body;
    if (!username || !password || !full_name || !role || !pin) return res.status(400).json({ error: 'All fields are required.' });
    if (!['admin', 'manager', 'cashier'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const password_hash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    pool.query('INSERT INTO users (id, username, password_hash, full_name, role, pin) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, password_hash, full_name, role, pin]);
    logAudit({ userId: req.user!.id, action: 'user_created', details: { userId: id, username, full_name, role } });
    res.status(201).json(pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?', [id]).rows[0]);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists.' });
    console.error(error); res.status(500).json({ error: 'Internal server error.' });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, role, pin, is_active, password } = req.body;

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      const fields: string[] = ['password_hash = ?'];
      const params: any[] = [password_hash];

      if (full_name !== undefined) { fields.push('full_name = ?'); params.push(full_name); }
      if (role !== undefined) { fields.push('role = ?'); params.push(role); }
      if (pin !== undefined && pin !== '') { fields.push('pin = ?'); params.push(pin); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

      fields.push("updated_at = datetime('now')");
      params.push(id);
      pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    } else {
      const fields: string[] = [];
      const params: any[] = [];

      if (full_name !== undefined) { fields.push('full_name = ?'); params.push(full_name); }
      if (role !== undefined) { fields.push('role = ?'); params.push(role); }
      if (pin !== undefined && pin !== '') { fields.push('pin = ?'); params.push(pin); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      fields.push("updated_at = datetime('now')");
      params.push(id);
      pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const result = pool.query('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    logAudit({ userId: req.user!.id, action: 'user_updated', details: { userId: id, username: result.rows[0].username, changes: req.body } });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) return res.status(400).json({ error: 'Cannot deactivate your own account.' });
    const result = pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    logAudit({ userId: req.user!.id, action: 'user_deactivated', details: { userId: id } });
    res.json({ message: 'User deactivated.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
