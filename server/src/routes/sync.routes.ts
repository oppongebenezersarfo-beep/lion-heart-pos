import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Sync offline sales
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sales } = req.body;

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return res.status(400).json({ error: 'No sales to sync.' });
    }

    const results: any[] = [];
    const conflicts: any[] = [];

    for (const offlineSale of sales) {
      try {
        // Validate stock availability first
        let stockAvailable = true;
        const insufficientItems = [];

        for (const item of offlineSale.items) {
          const stockResult = pool.query('SELECT current_stock, name FROM products WHERE id = ?', [item.product_id]);
          if (stockResult.rows.length === 0) {
            stockAvailable = false;
            insufficientItems.push({ productId: item.product_id, error: 'Product not found' });
            continue;
          }
          const currentStock = parseFloat(stockResult.rows[0].current_stock);
          if (currentStock < item.quantity) {
            stockAvailable = false;
            insufficientItems.push({
              productId: item.product_id, productName: stockResult.rows[0].name,
              requested: item.quantity, available: currentStock,
            });
          }
        }

        if (!stockAvailable) {
          conflicts.push({ offlineQueueId: offlineSale.offline_queue_id, items: insufficientItems, total: offlineSale.total });
          continue;
        }

        // Execute sale in transaction
        const saleResult = pool.transaction(() => {
          const now = new Date();
          const date = now.toISOString().slice(0, 10).replace(/-/g, '');
          const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const invoice_number = `LHH-${date}-${random}`;
          const saleId = crypto.randomUUID();

          pool.query(
            `INSERT INTO sales (id, invoice_number, cashier_id, customer_id, subtotal, discount_amount,
             total, payment_method, payment_details, status, is_offline_sale, offline_queue_id, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 1, ?, datetime('now'))`,
            [saleId, invoice_number, req.user!.id, offlineSale.customer_id || null,
             offlineSale.subtotal, offlineSale.discount_amount || 0, offlineSale.total,
             offlineSale.payment_method, JSON.stringify(offlineSale.payment_details || {}),
             offlineSale.offline_queue_id]
          );

          for (const item of offlineSale.items) {
            pool.query(
              `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, discount, total)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [crypto.randomUUID(), saleId, item.product_id, item.quantity, item.unit_price, item.discount || 0, item.total]
            );
            pool.query('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [item.quantity, item.product_id]);
            pool.query(
              `INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_id, created_by)
               VALUES (?, ?, 'sale', ?, ?, ?)`,
              [crypto.randomUUID(), item.product_id, -item.quantity, saleId, req.user!.id]
            );
          }

          if (offlineSale.customer_id && offlineSale.payment_method === 'credit') {
            pool.query('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?', [offlineSale.total, offlineSale.customer_id]);
          }

          return { saleId, invoice_number };
        });

        results.push({ offlineQueueId: offlineSale.offline_queue_id, newSaleId: saleResult.saleId, invoiceNumber: saleResult.invoice_number });
      } catch (error) {
        console.error('Error syncing individual sale:', error);
        conflicts.push({ offlineQueueId: offlineSale.offline_queue_id, error: 'Unexpected error during sync' });
      }
    }

    pool.query(
      'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
      [req.user!.id, 'offline_sync', JSON.stringify({ syncedCount: results.length, conflictCount: conflicts.length })]
    );

    res.json({ synced: results, conflicts });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
