import React, { useEffect, useState } from 'react';
import { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'cashier', pin: '' });

  const load = async () => {
    try { const r = await usersAPI.getAll(); setUsers(r.data); } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editUser) {
        const data: any = { full_name: form.full_name, role: form.role, pin: form.pin || undefined };
        if (form.password) data.password = form.password;
        await usersAPI.update(editUser.id, data);
        toast.success('User updated');
      } else {
        await usersAPI.create(form);
        toast.success('User created');
      }
      setShowForm(false); setEditUser(null);
      setForm({ username: '', password: '', full_name: '', role: 'cashier', pin: '' });
      load();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const toggleActive = async (user: any) => {
    try {
      await usersAPI.update(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      load();
    } catch (error: any) { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button onClick={() => { setEditUser(null); setForm({ username: '', password: '', full_name: '', role: 'cashier', pin: '' }); setShowForm(true); }}
          className="btn-primary">+ Add User</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700">
            <th className="text-left py-2">Name</th><th className="text-left py-2">Username</th>
            <th className="text-left py-2">Role</th><th className="text-left py-2">Status</th>
            <th className="text-right py-2">Actions</th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800">
                <td className="py-2">{u.full_name}</td>
                <td className="py-2 font-mono text-xs">{u.username}</td>
                <td className="py-2 capitalize">{u.role}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-xs ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 text-right space-x-2">
                  <button onClick={() => {
                    setEditUser(u);
                    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, pin: '' });
                    setShowForm(true);
                  }} className="text-blue-400 hover:text-blue-300">Edit</button>
                  <button onClick={() => toggleActive(u)}
                    className={u.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[450px]">
            <h2 className="text-xl font-bold mb-4">{editUser ? 'Edit' : 'Add'} User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editUser && (
                <div><label className="block text-sm text-gray-400 mb-1">Username *</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input-field" required /></div>
              )}
              <div><label className="block text-sm text-gray-400 mb-1">Full Name *</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" required /></div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field" required={!editUser} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field">
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Manager PIN *</label>
                  <input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className="input-field" required placeholder="4-digit PIN" /></div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditUser(null); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
