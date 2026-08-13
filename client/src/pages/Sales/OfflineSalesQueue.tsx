import React, { useState, useEffect } from 'react';
import { db, deleteOfflineSale, getUnsyncedSales, queueOfflineSale } from '../../db';
import { syncAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';
import toast from 'react-hot-toast';

export default function OfflineSalesQueue() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSales = async () => {
    try {
      const all = await db.offlineQueue.orderBy('created_at').reverse().toArray();
      setSales(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadSales(); }, []);

  const handleRetry = async (sale: any) => {
    try {
      const payload = {
        offline_queue_id: String(sale.id),
        items: sale.items,
        subtotal: sale.subtotal,
        discount_amount: sale.discount_amount,
        total: sale.total,
        payment_method: sale.payment_method,
        payment_details: sale.payment_details,
        customer_id: sale.customer_id,
        cashier_id: sale.cashier_id,
      };
      const response = await syncAPI.syncOfflineSales([payload]);
      const { synced, conflicts } = response.data;

      for (const item of synced) {
        if (item.offlineQueueId) {
          const { markSaleSynced } = await import('../../db');
          await markSaleSynced(Number(item.offlineQueueId));
        }
      }

      if (conflicts.length > 0) {
        toast.error('Still has stock conflict: ' + JSON.stringify(conflicts[0].items || []));
      } else {
        toast.success('Sale synced successfully');
      }
      loadSales();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Retry failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this offline sale permanently?')) return;
    await deleteOfflineSale(id);
    toast.success('Sale deleted');
    loadSales();
  };

  const unsynced = sales.filter(s => !s.synced);
  const synced = sales.filter(s => s.synced);
  const errored = sales.filter(s => s.sync_error);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Offline Sales Queue</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{unsynced.length}</p>
          <p className="text-sm text-gray-400">Pending Sync</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{errored.length}</p>
          <p className="text-sm text-gray-400">Conflicts</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{synced.length}</p>
          <p className="text-sm text-gray-400">Synced</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : unsynced.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <p>No pending offline sales</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unsynced.map((sale) => (
            <div key={sale.id} className={`card p-4 ${sale.sync_error ? 'border border-red-500/50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-mono text-gray-400">#{sale.id}</span>
                    {sale.sync_error && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">CONFLICT</span>
                    )}
                    {sale.retry_count > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                        Retries: {sale.retry_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">
                    {sale.items?.length || 0} items | {formatCedis(sale.total)} | {sale.payment_method}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateTime(sale.created_at)}</p>
                  {sale.sync_error && (
                    <p className="text-xs text-red-400 mt-1 truncate">{sale.sync_error}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handleRetry(sale)} className="btn-primary text-sm px-3 py-1">Retry</button>
                  <button onClick={() => handleDelete(sale.id)} className="text-red-400 hover:text-red-300 text-sm px-3 py-1">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
