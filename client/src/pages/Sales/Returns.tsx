import React, { useState } from 'react';
import { salesAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';
import toast from 'react-hot-toast';

export default function Returns() {
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [sale, setSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [loading, setLoading] = useState(false);

  const lookupSale = async () => {
    if (!invoiceSearch.trim()) { toast.error('Enter an invoice number'); return; }
    setLoading(true);
    setSale(null);
    setSaleItems([]);
    try {
      const response = await salesAPI.getAll({ invoice_number: invoiceSearch.trim() });
      const sales = response.data;
      if (sales.length === 0) { toast.error('Sale not found'); setLoading(false); return; }
      const foundSale = sales[0];
      const detailRes = await salesAPI.getById(foundSale.id);
      setSale(detailRes.data);
      setSaleItems(detailRes.data.items.map((item: any) => ({
        ...item, return_qty: 0,
      })));
    } catch { toast.error('Failed to look up sale'); }
    setLoading(false);
  };

  const toggleReturnItem = (index: number, qty: number) => {
    const updated = [...saleItems];
    updated[index].return_qty = Math.max(0, Math.min(qty, updated[index].quantity));
    setSaleItems(updated);
  };

  const itemsToReturn = saleItems.filter(i => i.return_qty > 0);
  const refundTotal = itemsToReturn.reduce((sum, i) => sum + i.return_qty * i.unit_price, 0);

  const processReturn = async () => {
    if (itemsToReturn.length === 0) { toast.error('Select items to return'); return; }
    if (!returnReason.trim()) { toast.error('Enter a reason for the return'); return; }

    const daysSinceSale = Math.floor((Date.now() - new Date(sale.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceSale > 7) { toast.error('Return window (7 days) has expired'); return; }

    try {
      const items = itemsToReturn.map(i => ({
        product_id: i.product_id, quantity: i.return_qty, unit_price: i.unit_price,
      }));
      const response = await salesAPI.processReturn(sale.id, { items, reason: returnReason });
      toast.success(`Return processed. Refund: ${formatCedis(response.data.refundTotal)}`);
      setSale(null);
      setSaleItems([]);
      setInvoiceSearch('');
      setReturnReason('');
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to process return'); }
  };

  const daysSince = sale ? Math.floor((Date.now() - new Date(sale.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const withinWindow = daysSince <= 7;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Returns & Refunds</h1>

      {/* Invoice Lookup */}
      <div className="card max-w-lg">
        <h2 className="text-lg font-bold mb-4">Look Up Sale</h2>
        <div className="flex gap-2">
          <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupSale()}
            className="input-field flex-1" placeholder="Enter invoice number..." />
          <button onClick={lookupSale} disabled={loading} className="btn-primary">
            {loading ? 'Searching...' : 'Look Up'}
          </button>
        </div>
      </div>

      {/* Sale Details + Return Form */}
      {sale && (
        <div className="space-y-4">
          {/* Sale Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-gray-400 text-sm">Invoice</p>
              <p className="font-bold font-mono">{sale.invoice_number}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Date</p>
              <p className="font-bold">{formatDateTime(sale.created_at)}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Total</p>
              <p className="font-bold text-lion-gold">{formatCedis(sale.total)}</p>
            </div>
            <div className="card">
              <p className="text-gray-400 text-sm">Status</p>
              <p className={`font-bold ${sale.status === 'returned' ? 'text-red-400' : sale.status === 'completed' ? 'text-green-400' : ''}`}>
                {sale.status}
              </p>
            </div>
          </div>

          {sale.status === 'returned' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 font-bold">This sale has already been returned.</p>
            </div>
          )}

          {!withinWindow && sale.status !== 'returned' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 font-bold">Return window (7 days) has expired ({daysSince} days ago).</p>
            </div>
          )}

          {/* Items to select for return */}
          {sale.status !== 'returned' && withinWindow && (
            <div className="card">
              <h3 className="font-bold mb-3">Select Items to Return</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-bold px-3">
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2 text-center">Qty Bought</div>
                  <div className="col-span-2 text-center">Return Qty</div>
                  <div className="col-span-3 text-right">Refund</div>
                </div>
                {saleItems.map((item: any, i: number) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-800 p-3 rounded">
                    <div className="col-span-5">
                      <p className="font-medium text-sm">{item.product_name || `Product ${item.product_id?.slice(0,8)}`}</p>
                      <p className="text-xs text-gray-400">{formatCedis(item.unit_price)} each</p>
                    </div>
                    <div className="col-span-2 text-center text-sm">{item.quantity}</div>
                    <div className="col-span-2 text-center">
                      <input type="number" min="0" max={item.quantity}
                        value={item.return_qty}
                        onChange={(e) => toggleReturnItem(i, parseInt(e.target.value) || 0)}
                        className="w-16 text-center bg-gray-700 border border-gray-600 rounded px-1 py-1 text-sm" />
                    </div>
                    <div className="col-span-3 text-right text-sm">
                      {item.return_qty > 0 ? (
                        <span className="text-red-400 font-bold">-{formatCedis(item.return_qty * item.unit_price)}</span>
                      ) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason + Confirm */}
          {itemsToReturn.length > 0 && (
            <div className="card max-w-lg">
              <h3 className="font-bold mb-3">Return Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Reason for Return *</label>
                  <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                    className="input-field" placeholder="e.g. Damaged, Wrong item, Customer changed mind" />
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-3">
                  <span>Refund Total</span>
                  <span className="text-red-400">{formatCedis(refundTotal)}</span>
                </div>
                <button onClick={processReturn} className="btn-danger w-full">Process Return</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
