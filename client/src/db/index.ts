import Dexie, { Table } from 'dexie';

export interface CachedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
  cached_at: Date;
}

export interface OfflineSale {
  id?: number;
  items: any[];
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_details: any;
  customer_id: string | null;
  cashier_id: string;
  created_at: Date;
  synced: boolean;
  synced_at: Date | null;
  sync_error: string | null;
}

export interface HeldSale {
  id?: number;
  sale_data: any;
  cashier_id: string;
  created_at: Date;
}

class LionHeartDB extends Dexie {
  products!: Table<CachedProduct>;
  offlineQueue!: Table<OfflineSale>;
  heldSales!: Table<HeldSale>;

  constructor() {
    super('LionHeartPOS');
    this.version(1).stores({
      products: 'id, sku, barcode, name, category_id, cached_at',
      offlineQueue: '++id, synced, cashier_id, created_at',
      heldSales: '++id, cashier_id, created_at',
    });
  }
}

export const db = new LionHeartDB();

// Cache products from server to IndexedDB
export async function cacheProducts(products: CachedProduct[]) {
  await db.transaction('rw', db.products, async () => {
    await db.products.clear();
    const withTimestamp = products.map(p => ({
      ...p,
      cached_at: new Date(),
    }));
    await db.products.bulkAdd(withTimestamp);
  });
}

// Get cached products (for offline use)
export async function getCachedProducts(): Promise<CachedProduct[]> {
  return await db.products.toArray();
}

// Search cached products (for offline barcode/name search)
export async function searchCachedProducts(query: string): Promise<CachedProduct[]> {
  const lowerQuery = query.toLowerCase();
  return await db.products
    .where('name')
    .startsWithIgnoreCase(lowerQuery)
    .or('sku')
    .startsWithIgnoreCase(lowerQuery)
    .or('barcode')
    .equals(query)
    .toArray();
}

// Add sale to offline queue
export async function queueOfflineSale(sale: Omit<OfflineSale, 'id' | 'synced' | 'synced_at' | 'sync_error'>): Promise<number> {
  return await db.offlineQueue.add({
    ...sale,
    synced: false,
    synced_at: null,
    sync_error: null,
  });
}

// Get all unsynced offline sales
export async function getUnsyncedSales(): Promise<OfflineSale[]> {
  return await db.offlineQueue.where('synced').equals(0 as any).toArray();
}

// Mark offline sale as synced
export async function markSaleSynced(id: number) {
  await db.offlineQueue.update(id, {
    synced: true,
    synced_at: new Date(),
  });
}

// Mark offline sale as sync error
export async function markSaleSyncError(id: number, error: string) {
  await db.offlineQueue.update(id, {
    sync_error: error,
  });
}

// Hold sale
export async function holdSale(saleData: any, cashierId: string): Promise<number> {
  return await db.heldSales.add({
    sale_data: saleData,
    cashier_id: cashierId,
    created_at: new Date(),
  });
}

// Get held sales for cashier
export async function getHeldSales(cashierId: string): Promise<HeldSale[]> {
  return await db.heldSales
    .where('cashier_id')
    .equals(cashierId)
    .reverse()
    .sortBy('created_at');
}

// Delete held sale
export async function deleteHeldSale(id: number) {
  await db.heldSales.delete(id);
}
