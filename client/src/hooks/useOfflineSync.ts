import { useEffect, useCallback, useRef } from 'react';
import { getUnsyncedSales, markSaleSynced, markSaleSyncError } from '../db';
import { syncAPI } from '../services/api';
import { useOnlineStatus } from './useOnlineStatus';
import toast from 'react-hot-toast';

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncSales = useCallback(async () => {
    try {
      const unsynced = await getUnsyncedSales();
      if (unsynced.length === 0) return;

      const salesToSync = unsynced.map((sale) => ({
        offline_queue_id: sale.id,
        items: sale.items,
        subtotal: sale.subtotal,
        discount_amount: sale.discount_amount,
        total: sale.total,
        payment_method: sale.payment_method,
        payment_details: sale.payment_details,
        customer_id: sale.customer_id,
        cashier_id: sale.cashier_id,
      }));

      const response = await syncAPI.syncOfflineSales(salesToSync);
      const { synced, conflicts } = response.data;

      // Mark successfully synced sales
      for (const item of synced) {
        if (item.offlineQueueId) {
          await markSaleSynced(item.offlineQueueId);
        }
      }

      // Mark conflicts
      for (const conflict of conflicts) {
        if (conflict.offlineQueueId) {
          await markSaleSyncError(conflict.offlineQueueId, JSON.stringify(conflict));
        }
      }

      if (synced.length > 0) {
        toast.success(`${synced.length} offline sale(s) synced successfully`);
      }

      if (conflicts.length > 0) {
        toast.error(`${conflicts.length} sale(s) have stock conflicts - manager review needed`);
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      // Sync immediately when coming online
      syncSales();

      // Then sync every 10 seconds
      syncIntervalRef.current = setInterval(syncSales, 10000);
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, syncSales]);

  return { syncSales, isOnline };
}
