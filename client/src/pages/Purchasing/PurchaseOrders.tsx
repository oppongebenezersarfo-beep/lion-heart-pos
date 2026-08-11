import React, { useEffect, useState } from 'react';
import { purchasesAPI, suppliersAPI, productsAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';
import toast from 'react-hot-toast';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState<any>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [form, setForm] = useState({ supplier_id: '', items: [{ product_id: '', quantity: '', unit_cost: '' }] });

  const load = async () => {
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        purchasesAPI.getAll(), suppliersAPI.getAll(), productsAPI.getAll()
      ]);
      setOrders(ordersRes.data); setSuppliers(suppliersRes.data); setProducts(productsRes.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        supplier_id: form.supplier_id,
        items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_cost: parseFloat(i.unit_cost) }))
      };
      await purchasesAPI.create(data);
      toast.success('Purchase order created');
      setShowForm(false);
      setForm({ supplier_id: '', items: [{ product_id: '', quantity: '', unit_cost: '' }] });
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const openReceiveModal = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      const itemsRes = await purchasesAPI.getById(orderId);
      const items = itemsRes.data.items.map((item: any) => ({
        ...item, received_quantity: item.quantity
      }));
      setReceiveOrder(order);
      setReceiveItems(items);
      setShowReceiveModal(true);
    } catch (error: any) { toast.error('Failed to load order details'); }
  };

  const confirmReceive = async () => {
    if (!receiveOrder) return;
    try {
      const received_items = receiveItems.map(item => ({
        id: item.id, product_id: item.product_id, received_quantity: item.received_quantity
      }));
      await purchasesAPI.receive(receiveOrder.id, { received_items });
      toast.success('Goods received, stock updated');
      setShowReceiveModal(false);
      setReceiveOrder(null);
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New Order</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700">
            <th className="text-left py-2">Order #</th><th className="text-left py-2">Supplier</th>
            <th className="text-right py-2">Total</th><th className="text-left py-2">Status</th>
            <th className="text-left py-2">Date</th><th className="text-right py-2">Actions</th>
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-800">
                <td className="py-2 font-mono text-xs">{o.order_number}</td>
                <td className="py-2">{o.supplier_name}</td>
                <td className="py-2 text-right">{formatCedis(o.total)}</td>
                <td className="py-2"><span className={`px-2 py-1 rounded text-xs ${
                  o.status === 'received' ? 'bg-green-500/20 text-green-400' :
                  o.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                }`}>{o.status}</span></td>
                <td className="py-2 text-gray-400">{formatDateTime(o.created_at)}</td>
                <td className="py-2 text-right">
                  {o.status === 'pending' && (
                    <button onClick={() => openReceiveModal(o.id)} className="text-green-400 hover:text-green-300">Receive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Order Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[600px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Purchase Order</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Supplier *</label>
                <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input-field" required>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Items</label>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={item.product_id} onChange={(e) => {
                      const items = [...form.items]; items[i].product_id = e.target.value; setForm({ ...form, items });
                    }} className="input-field flex-1" required>
                      <option value="">Select product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" step="0.01" placeholder="Qty" value={item.quantity}
                      onChange={(e) => { const items = [...form.items]; items[i].quantity = e.target.value; setForm({ ...form, items }); }}
                      className="input-field w-24" required />
                    <input type="number" step="0.01" placeholder="Cost" value={item.unit_cost}
                      onChange={(e) => { const items = [...form.items]; items[i].unit_cost = e.target.value; setForm({ ...form, items }); }}
                      className="input-field w-28" required />
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => {
                        setForm({ ...form, items: form.items.filter((_, j) => j !== i) });
                      }} className="text-red-400 px-2">X</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', quantity: '', unit_cost: '' }] })}
                  className="text-lion-gold text-sm">+ Add item</button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Confirmation Modal */}
      {showReceiveModal && receiveOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[550px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-2">Receive Goods</h2>
            <p className="text-sm text-gray-400 mb-4">
              Order: {receiveOrder.order_number} | Supplier: {receiveOrder.supplier_name}
            </p>
            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-bold">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-center">Ordered</div>
                <div className="col-span-2 text-center">Receiving</div>
                <div className="col-span-3 text-right">Unit Cost</div>
              </div>
              {receiveItems.map((item: any, i: number) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-800 p-2 rounded">
                  <div className="col-span-5 text-sm truncate">{item.product_name || item.product_id}</div>
                  <div className="col-span-2 text-center text-sm">{item.quantity}</div>
                  <div className="col-span-2 text-center">
                    <input type="number" step="0.01" min="0"
                      value={item.received_quantity}
                      onChange={(e) => {
                        const updated = [...receiveItems];
                        updated[i].received_quantity = parseFloat(e.target.value) || 0;
                        setReceiveItems(updated);
                      }}
                      className="w-full text-center bg-gray-700 border border-gray-600 rounded px-1 py-1 text-sm" />
                  </div>
                  <div className="col-span-3 text-right text-sm">{formatCedis(item.unit_cost)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 pt-3 mb-4 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-lion-gold">{formatCedis(receiveOrder.total)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowReceiveModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmReceive} className="btn-success flex-1">Confirm Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
