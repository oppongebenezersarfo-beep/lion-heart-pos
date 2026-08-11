import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await reportsAPI.getDashboard();
        setData(response.data);
      } catch (error) { console.error(error); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!data) return <div className="text-center py-8">Failed to load dashboard</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-gray-400 text-sm">Today's Sales</p>
          <p className="text-2xl font-bold text-lion-gold">{formatCedis(data.salesToday.total)}</p>
          <p className="text-sm text-gray-400">{data.salesToday.count} transactions</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">This Week</p>
          <p className="text-2xl font-bold text-lion-gold">{formatCedis(data.salesWeek.total)}</p>
          <p className="text-sm text-gray-400">{data.salesWeek.count} transactions</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-sm">This Month</p>
          <p className="text-2xl font-bold text-lion-gold">{formatCedis(data.salesMonth.total)}</p>
          <p className="text-sm text-gray-400">{data.salesMonth.count} transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4 text-red-400">Low Stock Alerts</h2>
          {data.lowStock.length === 0 ? (
            <p className="text-gray-400">All products are well stocked</p>
          ) : (
            <div className="space-y-2">
              {data.lowStock.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category_name}</p>
                  </div>
                  <span className="text-red-400 font-bold">{p.current_stock} / {p.reorder_level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4 text-lion-gold">Top Products (This Month)</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-gray-400">No sales data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topProducts.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{p.total_sold} sold</p>
                    <p className="text-xs text-gray-400">{formatCedis(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4">Recent Sales</h2>
        {data.recentSales.length === 0 ? (
          <p className="text-gray-400">No recent sales</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2">Invoice</th>
                  <th className="text-left py-2">Cashier</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-left py-2">Payment</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-800">
                    <td className="py-2 font-mono text-xs">{s.invoice_number}</td>
                    <td className="py-2">{s.cashier_name}</td>
                    <td className="py-2 text-right font-bold text-lion-gold">{formatCedis(s.total)}</td>
                    <td className="py-2 capitalize">{s.payment_method}</td>
                    <td className="py-2 text-gray-400">{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
