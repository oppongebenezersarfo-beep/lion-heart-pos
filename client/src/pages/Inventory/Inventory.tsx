import React, { useEffect, useState } from 'react';
import { productsAPI, suppliersAPI } from '../../services/api';
import { formatCedis } from '../../utils/format';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [form, setForm] = useState({
    sku: '', barcode: '', name: '', description: '', category_id: '',
    supplier_id: '', unit_of_measure: 'piece', cost_price: '', selling_price: '',
    current_stock: '', reorder_level: '',
  });

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ search });
      setProducts(response.data);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      setCategories(response.data);
    } catch (error) { console.error(error); }
  };

  const loadSuppliers = async () => {
    try {
      const response = await suppliersAPI.getAll();
      setSuppliers(response.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { loadProducts(); loadCategories(); loadSuppliers(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        cost_price: parseFloat(form.cost_price),
        selling_price: parseFloat(form.selling_price),
        current_stock: parseFloat(form.current_stock) || 0,
        reorder_level: parseFloat(form.reorder_level) || 0,
      };
      if (editProduct) {
        await productsAPI.update(editProduct.id, data);
        toast.success('Product updated');
      } else {
        await productsAPI.create(data);
        toast.success('Product created');
      }
      setShowForm(false);
      setEditProduct(null);
      resetForm();
      loadProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save product');
    }
  };

  const resetForm = () => {
    setForm({ sku: '', barcode: '', name: '', description: '', category_id: '',
      supplier_id: '', unit_of_measure: 'piece', cost_price: '', selling_price: '',
      current_stock: '', reorder_level: '' });
  };

  const startEdit = (product: any) => {
    setEditProduct(product);
    setForm({
      sku: product.sku, barcode: product.barcode || '', name: product.name,
      description: product.description || '', category_id: product.category_id || '',
      supplier_id: product.supplier_id || '', unit_of_measure: product.unit_of_measure,
      cost_price: product.cost_price.toString(), selling_price: product.selling_price.toString(),
      current_stock: product.current_stock.toString(), reorder_level: product.reorder_level.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete product "${name}"?`)) return;
    try {
      await productsAPI.delete(id);
      toast.success('Product deleted');
      loadProducts();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to delete'); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsAPI.createCategory(categoryForm);
      toast.success('Category created');
      setShowCategoryForm(false);
      setCategoryForm({ name: '', description: '' });
      loadCategories();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to create category'); }
  };

  const openAdjustModal = (product: any) => {
    setAdjustProduct(product);
    setAdjustAmount('');
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const handleAdjustStock = async () => {
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) { toast.error('Invalid adjustment amount'); return; }
    try {
      await productsAPI.adjustStock(adjustProduct.id, { adjustment: amount, reason: adjustReason });
      toast.success('Stock adjusted');
      setShowAdjustModal(false);
      loadProducts();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed to adjust stock'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryForm(true)} className="btn-secondary">+ Add Category</button>
          <button onClick={() => { resetForm(); setEditProduct(null); setShowForm(true); }} className="btn-primary">
            + Add Product
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          className="input-field pr-8" placeholder="Search products..." />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">X</button>
        )}
      </div>

      {/* Low Stock Warning */}
      {products.filter(p => p.current_stock <= p.reorder_level).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 font-bold">
            {products.filter(p => p.current_stock <= p.reorder_level).length} product(s) below reorder level
          </p>
        </div>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2">SKU</th>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Unit</th>
                <th className="text-right py-2">Cost</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Stock</th>
                <th className="text-right py-2">Reorder</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={`border-b border-gray-800 ${
                  p.current_stock <= p.reorder_level ? 'bg-red-500/5' : ''
                }`}>
                  <td className="py-2 font-mono text-xs">{p.sku}</td>
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-gray-400">{p.category_name || '-'}</td>
                  <td className="py-2">{p.unit_of_measure}</td>
                  <td className="py-2 text-right">{formatCedis(p.cost_price)}</td>
                  <td className="py-2 text-right">{formatCedis(p.selling_price)}</td>
                  <td className={`py-2 text-right font-bold ${
                    p.current_stock <= p.reorder_level ? 'text-red-400' : ''
                  }`}>{p.current_stock}</td>
                  <td className="py-2 text-right text-gray-400">{p.reorder_level}</td>
                  <td className="py-2 text-right space-x-1">
                    <button onClick={() => startEdit(p)} className="text-blue-400 hover:text-blue-300">Edit</button>
                    <button onClick={() => openAdjustModal(p)} className="text-yellow-400 hover:text-yellow-300">Adjust</button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[600px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SKU *</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Barcode</label>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="input-field">
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Unit of Measure *</label>
                  <select value={form.unit_of_measure} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                    className="input-field">
                    <option value="piece">Piece</option>
                    <option value="bag">Bag</option>
                    <option value="roll">Roll</option>
                    <option value="length">Length/Meter</option>
                    <option value="box">Box</option>
                    <option value="kg">Kilogram</option>
                    <option value="meter">Meter</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Supplier</label>
                <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="input-field">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Cost Price (GHS) *</label>
                  <input type="number" step="0.01" value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Selling Price (GHS) *</label>
                  <input type="number" step="0.01" value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    className="input-field" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Current Stock</label>
                  <input type="number" step="0.01" value={form.current_stock}
                    onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Reorder Level</label>
                  <input type="number" step="0.01" value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditProduct(null); }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  {editProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Creation Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[400px]">
            <h2 className="text-xl font-bold mb-4">Add Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="input-field" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="input-field" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCategoryForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && adjustProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[450px]">
            <h2 className="text-xl font-bold mb-2">Adjust Stock</h2>
            <p className="text-sm text-gray-400 mb-4">
              Product: {adjustProduct.name} | Current Stock: {adjustProduct.current_stock}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Adjustment (positive = add, negative = subtract)
                </label>
                <input type="number" step="0.01" value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="input-field" placeholder="e.g. +10 or -5" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason</label>
                <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                  className="input-field" placeholder="e.g. New delivery, Damaged goods" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdjustModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdjustStock} className="btn-primary flex-1">Adjust</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
