import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// Get all products
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category_id, low_stock } = req.query;

    let query = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.is_active = 1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode = ?)`;
      params.push(`%${search}%`, `%${search}%`, search);
    }

    if (category_id) {
      query += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (low_stock === 'true') {
      query += ` AND p.current_stock <= p.reorder_level`;
    }

    query += ' ORDER BY p.name ASC';

    const result = pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get product by barcode
router.get('/barcode/:barcode', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { barcode } = req.params;

    const result = pool.query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.barcode = ? AND p.is_active = 1`,
      [barcode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product by barcode error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get categories (must be before /:id to avoid route conflict)
router.get('/meta/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get product by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = pool.query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create product
router.post('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      sku, barcode, name, description, category_id, supplier_id,
      unit_of_measure, cost_price, selling_price, current_stock, reorder_level
    } = req.body;

    if (!sku || !name || !unit_of_measure || cost_price === undefined || selling_price === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (selling_price < cost_price) {
      return res.status(400).json({ error: 'Selling price cannot be less than cost price without manager override.' });
    }

    const id = crypto.randomUUID();
    pool.query(
      `INSERT INTO products (id, sku, barcode, name, description, category_id, supplier_id,
       unit_of_measure, cost_price, selling_price, current_stock, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sku, barcode || null, name, description || null, category_id || null, supplier_id || null,
       unit_of_measure, cost_price, selling_price, current_stock || 0, reorder_level || 0]
    );

    const result = pool.query('SELECT * FROM products WHERE id = ?', [id]);

    pool.query(
      'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      [req.user!.id, 'product_created', JSON.stringify({ productId: id, name })]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'SKU or barcode already exists.' });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update product
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      sku, barcode, name, description, category_id, supplier_id,
      unit_of_measure, cost_price, selling_price, current_stock, reorder_level, is_active
    } = req.body;

    pool.query(
      `UPDATE products SET
        sku = COALESCE(?, sku),
        barcode = ?,
        name = COALESCE(?, name),
        description = ?,
        category_id = ?,
        supplier_id = ?,
        unit_of_measure = COALESCE(?, unit_of_measure),
        cost_price = COALESCE(?, cost_price),
        selling_price = COALESCE(?, selling_price),
        current_stock = COALESCE(?, current_stock),
        reorder_level = COALESCE(?, reorder_level),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
       WHERE id = ?`,
      [sku || null, barcode || null, name || null, description || null,
       category_id || null, supplier_id || null,
       unit_of_measure || null, cost_price, selling_price, current_stock, reorder_level, is_active, id]
    );

    const result = pool.query('SELECT * FROM products WHERE id = ?', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'SKU or barcode already exists.' });
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create category
router.post('/categories', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const id = crypto.randomUUID();
    pool.query(
      'INSERT INTO categories (id, name, description) VALUES (?, ?, ?)',
      [id, name, description || null]
    );

    const result = pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category already exists.' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete product
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const salesItems = pool.query('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?', [id]);
    if (salesItems.rows[0].count > 0) {
      pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ message: 'Product deactivated (has sales history).' });
    }
    pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

// Stock adjustment
router.post('/:id/adjust-stock', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;
    if (adjustment === undefined || adjustment === 0) return res.status(400).json({ error: 'Invalid adjustment.' });
    const product = pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const newStock = product.rows[0].current_stock + adjustment;
    if (newStock < 0) return res.status(400).json({ error: 'Stock cannot be negative.' });
    pool.query('UPDATE products SET current_stock = ?, updated_at = datetime(\'now\') WHERE id = ?', [newStock, id]);
    pool.query('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      [req.user!.id, 'stock_adjustment', JSON.stringify({ productId: id, adjustment, reason, newStock })]);
    res.json({ message: 'Stock adjusted.', newStock });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
