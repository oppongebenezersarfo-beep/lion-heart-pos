import React, { useEffect, useState } from 'react';
import { suppliersAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });

  const load = async () => {
    try { const r = await suppliersAPI.getAll({ search }); setSuppliers(r.data); } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editSupplier) { await suppliersAPI.update(editSupplier.id, form); toast.success('Supplier updated'); }
      else { await suppliersAPI.create(form); toast.success('Supplier created'); }
      setShowForm(false); setEditSupplier(null);
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      await suppliersAPI.delete(id);
      toast.success('Supplier deleted');
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <button onClick={() => { setEditSupplier(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '' }); setShowForm(true); }} className="btn-primary">+ Add Supplier</button>
      </div>
      <div className="relative max-w-md">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-8" placeholder="Search suppliers..." />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">X</button>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700">
            <th className="text-left py-2">Name</th><th className="text-left py-2">Contact Person</th>
            <th className="text-left py-2">Phone</th><th className="text-left py-2">Email</th>
            <th className="text-right py-2">Actions</th>
          </tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-gray-800">
                <td className="py-2">{s.name}</td><td className="py-2">{s.contact_person || '-'}</td>
                <td className="py-2">{s.phone || '-'}</td><td className="py-2">{s.email || '-'}</td>
                <td className="py-2 text-right space-x-1">
                  <button onClick={() => { setEditSupplier(s); setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '' }); setShowForm(true); }} className="text-blue-400 hover:text-blue-300">Edit</button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="text-red-400 hover:text-red-300">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[500px]">
            <h2 className="text-xl font-bold mb-4">{editSupplier ? 'Edit' : 'Add'} Supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Contact Person</label>
                <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" /></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" placeholder="Physical address" /></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditSupplier(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editSupplier ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
