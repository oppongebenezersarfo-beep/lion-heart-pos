import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { config } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// Login — supports both POST JSON and GET query params (Cloudflare bypass)
router.post('/login', handleLogin);
router.get('/login', handleLogin);

async function handleLogin(req: Request, res: Response) {
  try {
    let username: string | undefined;
    let password: string | undefined;

    if (req.method === 'GET') {
      username = req.query.username as string;
      password = req.query.password as string;
    } else {
      username = req.body?.username;
      password = req.body?.password;
    }

    console.log(`Login attempt: username=${username}, method=${req.method}, body=${JSON.stringify(req.body)}, query=${JSON.stringify(req.query)}`);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = pool.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

    if (result.rows.length === 0) {
      logAudit({ action: 'login_failed', details: { username, reason: 'user_not_found' }, ipAddress: req.ip });
      console.log(`Login failed: user_not_found (${username})`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      logAudit({ userId: user.id, action: 'login_failed', details: { username, reason: 'wrong_password' }, ipAddress: req.ip });
      console.log(`Login failed: wrong_password (${username})`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    logAudit({ userId: user.id, action: 'login_success', details: { username, role: user.role }, ipAddress: req.ip });
    console.log(`Login success: ${username} (${user.role})`);

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
}

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

    logAudit({ userId: req.user!.id, action: 'pin_verification', details: { approverId: approver.id, approverName: approver.full_name, action } });

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
