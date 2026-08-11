import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params: any[] = [];
    if (search) { query += ' AND (name LIKE ? OR contact_person LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY name ASC';
    res.json(pool.query(query, params).rows);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required.' });
    const id = crypto.randomUUID();
    pool.query('INSERT INTO suppliers (id, name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, contact_person || null, phone || null, email || null, address || null]);
    res.status(201).json(pool.query('SELECT * FROM suppliers WHERE id = ?', [id]).rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address } = req.body;
    pool.query('UPDATE suppliers SET name=COALESCE(?,name), contact_person=?, phone=?, email=?, address=?, updated_at=datetime(\'now\') WHERE id=?',
      [name, contact_person, phone, email, address, id]);
    const result = pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (supplier.rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' });
    const products = pool.query('SELECT COUNT(*) as count FROM products WHERE supplier_id = ?', [id]);
    if (products.rows[0].count > 0) return res.status(400).json({ error: 'Cannot delete supplier with products.' });
    pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ message: 'Supplier deleted.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
