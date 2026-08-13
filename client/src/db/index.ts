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

export interface CachedCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_credit_approved: boolean;
  credit_limit: number;
  outstanding_balance: number;
  credit_terms_days: number;
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
  retry_count: number;
}

export interface HeldSale {
  id?: number;
  sale_data: any;
  cashier_id: string;
  created_at: Date;
}

class LionHeartDB extends Dexie {
  products!: Table<CachedProduct>;
  customers!: Table<CachedCustomer>;
  offlineQueue!: Table<OfflineSale>;
  heldSales!: Table<HeldSale>;

  constructor() {
    super('LionHeartPOS');
    this.version(2).stores({
      products: 'id, sku, barcode, name, category_id, cached_at',
      customers: 'id, name, phone, cached_at',
      offlineQueue: '++id, synced, cashier_id, created_at',
      heldSales: '++id, cashier_id, created_at',
    });
  }
}

export const db = new LionHeartDB();

export async function cacheProducts(products: CachedProduct[]) {
  await db.transaction('rw', db.products, async () => {
    await db.products.clear();
    const withTimestamp = products.map(p => ({ ...p, cached_at: new Date() }));
    await db.products.bulkAdd(withTimestamp);
  });
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  return await db.products.toArray();
}

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

export async function cacheCustomers(customers: CachedCustomer[]) {
  await db.transaction('rw', db.customers, async () => {
    await db.customers.clear();
    const withTimestamp = customers.map(c => ({ ...c, cached_at: new Date() }));
    await db.customers.bulkAdd(withTimestamp);
  });
}

export async function searchCachedCustomers(query: string): Promise<CachedCustomer[]> {
  const lowerQuery = query.toLowerCase();
  return await db.customers
    .where('name')
    .startsWithIgnoreCase(lowerQuery)
    .or('phone')
    .startsWithIgnoreCase(lowerQuery)
    .toArray();
}

export async function getCachedCustomerById(id: string): Promise<CachedCustomer | undefined> {
  return await db.customers.get(id);
}

export async function queueOfflineSale(sale: Omit<OfflineSale, 'id' | 'synced' | 'synced_at' | 'sync_error' | 'retry_count'>): Promise<number> {
  return await db.offlineQueue.add({
    ...sale,
    synced: false,
    synced_at: null,
    sync_error: null,
    retry_count: 0,
  });
}

export async function getUnsyncedSales(): Promise<OfflineSale[]> {
  return await db.offlineQueue.where('synced').equals(0 as any).toArray();
}

export async function getPendingCount(): Promise<number> {
  return await db.offlineQueue.where('synced').equals(0 as any).count();
}

export async function markSaleSynced(id: number) {
  await db.offlineQueue.update(id, {
    synced: true,
    synced_at: new Date(),
    sync_error: null,
  });
}

export async function markSaleSyncError(id: number, error: string) {
  const sale = await db.offlineQueue.get(id);
  await db.offlineQueue.update(id, {
    sync_error: error,
    retry_count: (sale?.retry_count || 0) + 1,
  });
}

export async function deleteOfflineSale(id: number) {
  await db.offlineQueue.delete(id);
}

export async function holdSale(saleData: any, cashierId: string): Promise<number> {
  return await db.heldSales.add({
    sale_data: saleData,
    cashier_id: cashierId,
    created_at: new Date(),
  });
}

export async function getHeldSales(cashierId: string): Promise<HeldSale[]> {
  return await db.heldSales
    .where('cashier_id')
    .equals(cashierId)
    .reverse()
    .sortBy('created_at');
}

export async function deleteHeldSale(id: number) {
  await db.heldSales.delete(id);
}
