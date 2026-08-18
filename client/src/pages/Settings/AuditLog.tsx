import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const actionLabels: Record<string, string> = {
  login_success: 'Login',
  login_failed: 'Login Failed',
  pin_verification: 'PIN Verified',
  sale_created: 'Sale Made',
  sale_returned: 'Sale Return',
  product_created: 'Product Added',
  product_updated: 'Product Updated',
  product_deactivated: 'Product Deactivated',
  product_deleted: 'Product Deleted',
  stock_adjustment: 'Stock Adjustment',
  user_created: 'User Created',
  user_updated: 'User Updated',
  user_deactivated: 'User Deactivated',
  customer_created: 'Customer Added',
  customer_updated: 'Customer Updated',
  customer_deleted: 'Customer Deleted',
  customer_payment: 'Customer Payment',
  supplier_created: 'Supplier Added',
  supplier_updated: 'Supplier Updated',
  supplier_deleted: 'Supplier Deleted',
  purchase_order_created: 'Purchase Order Created',
  purchase_received: 'Purchase Received',
  shift_started: 'Shift Started',
  shift_closed: 'Shift Closed',
  offline_sync: 'Offline Sync',
};

const actionColors: Record<string, string> = {
  login_success: 'text-green-400',
  login_failed: 'text-red-400',
  sale_created: 'text-lion-gold',
  sale_returned: 'text-orange-400',
  product_created: 'text-blue-400',
  product_updated: 'text-blue-400',
  product_deactivated: 'text-yellow-400',
  product_deleted: 'text-red-400',
  stock_adjustment: 'text-purple-400',
  user_created: 'text-green-400',
  user_updated: 'text-blue-400',
  user_deactivated: 'text-red-400',
  customer_created: 'text-green-400',
  customer_payment: 'text-lion-gold',
  supplier_created: 'text-green-400',
  purchase_order_created: 'text-blue-400',
  purchase_received: 'text-green-400',
  shift_started: 'text-green-400',
  shift_closed: 'text-orange-400',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', '50');
      if (filterAction) params.set('action', filterAction);
      if (filterUser) params.set('user_id', filterUser);
      if (filterDate) params.set('start_date', filterDate);
      if (filterEndDate) params.set('end_date', filterEndDate + ' 23:59:59');

      const r = await api.get(`/audit-log?${params.toString()}`);
      setLogs(r.data.logs);
      setActions(r.data.actions || []);
      setTotalPages(r.data.pagination.pages);
      setTotal(r.data.pagination.total);
      setPage(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const handleSearch = () => { load(1); };

  const formatDetails = (details: any, action: string) => {
    if (!details) return '';
    try {
      const d = typeof details === 'string' ? JSON.parse(details) : details;
      switch (action) {
        case 'sale_created': return `Invoice: ${d.invoiceNumber} | GHS ${d.total} | ${d.paymentMethod}`;
        case 'sale_returned': return `Refund: GHS ${d.refundTotal} | ${d.reason || 'No reason'}`;
        case 'product_created': case 'product_updated': case 'product_deleted': case 'product_deactivated': return d.name || d.productId || '';
        case 'stock_adjustment': return `${d.name}: ${d.adjustment > 0 ? '+' : ''}${d.adjustment} (now ${d.newStock}) | ${d.reason || ''}`;
        case 'customer_created': case 'customer_updated': case 'customer_deleted': return d.name || d.customerId || '';
        case 'customer_payment': return `GHS ${d.amount} via ${d.paymentMethod}`;
        case 'supplier_created': case 'supplier_updated': case 'supplier_deleted': return d.name || d.supplierId || '';
        case 'purchase_order_created': return `${d.order_number} | GHS ${d.total} | ${d.itemCount} items`;
        case 'purchase_received': return `PO received`;
        case 'user_created': case 'user_updated': case 'user_deactivated': return d.username || d.userId || '';
        case 'shift_started': return `Opening cash: GHS ${d.openingCash}`;
        case 'shift_closed': return `Closing: GHS ${d.closingCash} | Expected: GHS ${d.expectedCash} | Diff: GHS ${d.difference}`;
        case 'login_success': return `${d.role}`;
        case 'login_failed': return d.reason || '';
        case 'pin_verification': return `Approver: ${d.approverName} | ${d.action}`;
        default: return JSON.stringify(d);
      }
    } catch { return ''; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <span className="text-sm text-gray-400">{total} total entries</span>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Action</label>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Actions</option>
              {actions.map((a) => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Start Date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="input-field w-full text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">End Date</label>
            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="input-field w-full text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleSearch} className="btn-primary flex-1 py-2 text-sm">Search</button>
            <button onClick={() => { setFilterAction(''); setFilterUser(''); setFilterDate(''); setFilterEndDate(''); }} className="btn-secondary py-2 text-sm">Clear</button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No audit entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-3 text-gray-300 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="text-white font-medium">{log.full_name || 'System'}</div>
                      <div className="text-xs text-gray-500">{log.username || '-'}</div>
                    </td>
                    <td className="p-3">
                      <span className={`font-medium ${actionColors[log.action] || 'text-gray-300'}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-xs max-w-xs truncate">
                      {formatDetails(log.details, log.action)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => load(page - 1)} disabled={page <= 1}
            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages}
            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
