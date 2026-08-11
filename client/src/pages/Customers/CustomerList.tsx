import React, { useEffect, useState } from 'react';
import { customersAPI } from '../../services/api';
import { formatCedis } from '../../utils/format';
import toast from 'react-hot-toast';

export default function CustomerList() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', credit_limit: '', credit_terms_days: '30', is_credit_approved: false });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesCustomer, setSalesCustomer] = useState<any>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const load = async () => {
    try { const r = await customersAPI.getAll({ search }); setCustomers(r.data); } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...form, credit_limit: parseFloat(form.credit_limit) || 0, credit_terms_days: parseInt(form.credit_terms_days) || 30 };
      if (editCustomer) { await customersAPI.update(editCustomer.id, data); toast.success('Customer updated'); }
      else { await customersAPI.create(data); toast.success('Customer created'); }
      setShowForm(false); setEditCustomer(null);
      setForm({ name: '', phone: '', email: '', address: '', credit_limit: '', credit_terms_days: '30', is_credit_approved: false });
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    try {
      await customersAPI.delete(id);
      toast.success('Customer deleted');
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to delete'); }
  };

  const openPaymentModal = (customer: any) => {
    setPaymentCustomer(customer);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const recordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return; }
    try {
      await customersAPI.recordPayment(paymentCustomer.id, { amount, payment_method: paymentMethod, notes: paymentNotes });
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const openSalesModal = async (customer: any) => {
    setSalesCustomer(customer);
    setShowSalesModal(true);
    setLoadingSales(true);
    try {
      const res = await customersAPI.getSales(customer.id);
      setSalesData(res.data);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoadingSales(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={() => { setEditCustomer(null); setForm({ name: '', phone: '', email: '', address: '', credit_limit: '', credit_terms_days: '30', is_credit_approved: false }); setShowForm(true); }} className="btn-primary">+ Add Customer</button>
      </div>
      <div className="relative max-w-md">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-8" placeholder="Search by name or phone..." />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">X</button>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700">
            <th className="text-left py-2">Name</th><th className="text-left py-2">Phone</th>
            <th className="text-right py-2">Credit Limit</th><th className="text-right py-2">Balance</th>
            <th className="text-left py-2">Credit Status</th><th className="text-right py-2">Actions</th>
          </tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-800">
                <td className="py-2">{c.name}</td><td className="py-2">{c.phone || '-'}</td>
                <td className="py-2 text-right">{formatCedis(c.credit_limit)}</td>
                <td className={`py-2 text-right font-bold ${c.outstanding_balance > 0 ? 'text-red-400' : ''}`}>{formatCedis(c.outstanding_balance)}</td>
                <td className="py-2">{c.is_credit_approved ? <span className="text-green-400">Approved</span> : <span className="text-gray-400">N/A</span>}</td>
                <td className="py-2 text-right space-x-1">
                  {c.outstanding_balance > 0 && (
                    <button onClick={() => openPaymentModal(c)} className="text-green-400 hover:text-green-300">Payment</button>
                  )}
                  <button onClick={() => openSalesModal(c)} className="text-blue-400 hover:text-blue-300">Sales</button>
                  <button onClick={() => { setEditCustomer(c); setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', credit_limit: c.credit_limit.toString(), credit_terms_days: c.credit_terms_days.toString(), is_credit_approved: c.is_credit_approved }); setShowForm(true); }} className="text-blue-400 hover:text-blue-300">Edit</button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[500px]">
            <h2 className="text-xl font-bold mb-4">{editCustomer ? 'Edit' : 'Add'} Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Credit Limit (GHS)</label>
                  <input type="number" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Terms (days)</label>
                  <input type="number" value={form.credit_terms_days} onChange={(e) => setForm({ ...form, credit_terms_days: e.target.value })} className="input-field" /></div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_credit_approved} onChange={(e) => setForm({ ...form, is_credit_approved: e.target.checked })} className="rounded" />
                <span className="text-sm">Credit Approved</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditCustomer(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editCustomer ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Record Payment Modal */}
      {showPaymentModal && paymentCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[450px]">
            <h2 className="text-xl font-bold mb-2">Record Payment</h2>
            <p className="text-sm text-gray-400 mb-4">Customer: {paymentCustomer.name} | Balance: {formatCedis(paymentCustomer.outstanding_balance)}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (GHS)</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="input-field" placeholder="Enter amount" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field">
                  <option value="cash">Cash</option>
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="telecel">Telecel</option>
                  <option value="airteltigo">AirtelTigo</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="input-field" placeholder="Optional notes" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={recordPayment} className="btn-success flex-1">Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View Sales Modal */}
      {showSalesModal && salesCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-2">Sales for {salesCustomer.name}</h2>
            <p className="text-sm text-gray-400 mb-4">Total Balance: {formatCedis(salesCustomer.outstanding_balance)}</p>
            {loadingSales ? (
              <p className="text-gray-400">Loading...</p>
            ) : salesData.length === 0 ? (
              <p className="text-gray-400">No sales found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-700">
                  <th className="text-left py-2">Date</th><th className="text-left py-2">Invoice</th>
                  <th className="text-right py-2">Total</th><th className="text-right py-2">Method</th>
                </tr></thead>
                <tbody>
                  {salesData.map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-800">
                      <td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="py-2">{s.invoice_number}</td>
                      <td className="py-2 text-right">{formatCedis(s.total)}</td>
                      <td className="py-2 text-right">{s.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button onClick={() => setShowSalesModal(false)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
