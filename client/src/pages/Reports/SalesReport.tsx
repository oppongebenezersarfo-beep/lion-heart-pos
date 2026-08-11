import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';

export default function SalesReport() {
  const [tab, setTab] = useState<'sales' | 'profit' | 'lowstock' | 'offlinesync'>('sales');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [profitData, setProfitData] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [offlineSync, setOfflineSync] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState('day');

  const loadSales = async () => {
    try {
      const params: any = { group_by: groupBy };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await reportsAPI.getSales(params);
      setSalesData(r.data);
    } catch (e) { console.error(e); }
  };

  const loadProfit = async () => {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await reportsAPI.getProfit(params);
      setProfitData(r.data);
    } catch (e) { console.error(e); }
  };

  const loadLowStock = async () => {
    try { const r = await reportsAPI.getLowStock(); setLowStock(r.data); } catch (e) { console.error(e); }
  };

  const loadOfflineSync = async () => {
    try { const r = await reportsAPI.getOfflineSync(); setOfflineSync(r.data); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (tab === 'sales') loadSales();
    else if (tab === 'profit') loadProfit();
    else if (tab === 'lowstock') loadLowStock();
    else if (tab === 'offlinesync') loadOfflineSync();
  }, [tab, startDate, endDate, groupBy]);

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(','), ...data.map(row => headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex gap-2">
        {(['sales', 'profit', 'lowstock', 'offlinesync'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-medium ${tab === t ? 'bg-lion-gold text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {t === 'sales' ? 'Sales' : t === 'profit' ? 'Profit' : t === 'lowstock' ? 'Low Stock' : 'Offline Sync'}
          </button>
        ))}
      </div>

      {(tab === 'sales' || tab === 'profit') && (
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
          {tab === 'sales' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Group By</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="input-field">
                <option value="day">Day</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          )}
          <button onClick={() => exportCSV(tab === 'sales' ? salesData : profitData, `${tab}_report.csv`)}
            className="btn-secondary">Export CSV</button>
        </div>
      )}

      {tab === 'lowstock' && (
        <div className="flex gap-2">
          <button onClick={() => exportCSV(lowStock, 'low_stock_report.csv')} className="btn-secondary">Export Low Stock CSV</button>
        </div>
      )}

      {tab === 'offlinesync' && (
        <div className="flex gap-2">
          <button onClick={() => exportCSV(offlineSync, 'offline_sync_report.csv')} className="btn-secondary">Export Offline Sync CSV</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {tab === 'sales' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-700">
              {salesData.length > 0 && Object.keys(salesData[0]).map((key) => (
                <th key={key} className="text-left py-2 capitalize">{key.replace(/_/g, ' ')}</th>
              ))}
            </tr></thead>
            <tbody>
              {salesData.map((row, i) => (
                <tr key={i} className="border-b border-gray-800">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="py-2">{typeof val === 'number' && val > 100 ? formatCedis(val) : String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'profit' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-700">
              <th className="text-left py-2">Product</th><th className="text-right py-2">Cost</th>
              <th className="text-right py-2">Price</th><th className="text-right py-2">Sold</th>
              <th className="text-right py-2">Revenue</th><th className="text-right py-2">Profit</th>
              <th className="text-right py-2">Margin %</th>
            </tr></thead>
            <tbody>
              {profitData.map((row, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-right">{formatCedis(parseFloat(row.cost_price))}</td>
                  <td className="py-2 text-right">{formatCedis(parseFloat(row.selling_price))}</td>
                  <td className="py-2 text-right">{row.total_sold}</td>
                  <td className="py-2 text-right">{formatCedis(parseFloat(row.revenue))}</td>
                  <td className="py-2 text-right font-bold text-green-400">{formatCedis(parseFloat(row.profit))}</td>
                  <td className="py-2 text-right">{row.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'lowstock' && (
          <div className="space-y-2">
            {lowStock.length === 0 ? <p className="text-gray-400">All products well stocked</p> :
              lowStock.map((p) => (
                <div key={p.id} className="flex justify-between items-center bg-gray-800 p-3 rounded">
                  <div><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.category_name} | {p.supplier_name || 'No supplier'}</p></div>
                  <div className="text-right"><p className="text-red-400 font-bold">{p.current_stock} / {p.reorder_level}</p><p className="text-xs text-gray-400">{p.unit_of_measure}</p></div>
                </div>
              ))}
          </div>
        )}

        {tab === 'offlinesync' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-700">
              <th className="text-left py-2">Invoice</th><th className="text-left py-2">Cashier</th>
              <th className="text-right py-2">Total</th><th className="text-left py-2">Payment</th>
              <th className="text-left py-2">Synced At</th>
            </tr></thead>
            <tbody>
              {offlineSync.map((s) => (
                <tr key={s.id} className="border-b border-gray-800">
                  <td className="py-2 font-mono text-xs">{s.invoice_number}</td>
                  <td className="py-2">{s.cashier_name}</td>
                  <td className="py-2 text-right">{formatCedis(s.total)}</td>
                  <td className="py-2 capitalize">{s.payment_method}</td>
                  <td className="py-2 text-gray-400">{formatDateTime(s.synced_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
