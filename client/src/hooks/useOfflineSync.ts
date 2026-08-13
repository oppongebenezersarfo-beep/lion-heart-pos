import { useEffect, useCallback, useRef, useState, createContext, useContext } from 'react';
import { getUnsyncedSales, markSaleSynced, markSaleSyncError, getPendingCount } from '../db';
import { syncAPI } from '../services/api';
import { useOnlineStatus } from './useOnlineStatus';
import toast from 'react-hot-toast';

const MAX_RETRIES = 5;
const BASE_INTERVAL = 10000;

interface OfflineSyncState {
  syncSales: () => Promise<void>;
  isOnline: boolean;
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
}

export const OfflineSyncContext = createContext<OfflineSyncState>({
  syncSales: async () => {},
  isOnline: true,
  pendingCount: 0,
  refreshPendingCount: async () => {},
});

export function useOfflineSync(): OfflineSyncState {
  const isOnline = useOnlineStatus();
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const syncSales = useCallback(async () => {
    try {
      const unsynced = await getUnsyncedSales();
      if (unsynced.length === 0) {
        setPendingCount(0);
        return;
      }

      const toSync = unsynced.filter(s => (s.retry_count || 0) < MAX_RETRIES);
      if (toSync.length === 0) return;

      const salesToSync = toSync.map((sale) => ({
        offline_queue_id: String(sale.id),
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

      for (const item of synced) {
        if (item.offlineQueueId) {
          await markSaleSynced(Number(item.offlineQueueId));
        }
      }

      for (const conflict of conflicts) {
        if (conflict.offlineQueueId) {
          await markSaleSyncError(Number(conflict.offlineQueueId), JSON.stringify(conflict));
        }
      }

      if (synced.length > 0) {
        toast.success(`${synced.length} offline sale(s) synced`);
      }

      if (conflicts.length > 0) {
        toast.error(`${conflicts.length} sale(s) have stock conflicts - manager review needed`);
      }

      await refreshPendingCount();
    } catch (error) {
      console.error('Sync error:', error);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (isOnline) {
      syncSales();
      syncIntervalRef.current = setInterval(syncSales, BASE_INTERVAL);
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

  return { syncSales, isOnline, pendingCount, refreshPendingCount };
}
