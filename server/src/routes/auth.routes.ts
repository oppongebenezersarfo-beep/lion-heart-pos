import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { config } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = pool.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query(
      'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Verify manager PIN
router.post('/verify-pin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pin, action } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    const result = pool.query(
      "SELECT id, full_name, role FROM users WHERE pin = ? AND role IN ('admin', 'manager') AND is_active = 1",
      [pin]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }

    const approver = result.rows[0];

    pool.query(
      'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      [req.user!.id, 'pin_verification', JSON.stringify({ approverId: approver.id, action })]
    );

    res.json({
      valid: true,
      approver: {
        id: approver.id,
        fullName: approver.full_name,
        role: approver.role,
      },
    });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
