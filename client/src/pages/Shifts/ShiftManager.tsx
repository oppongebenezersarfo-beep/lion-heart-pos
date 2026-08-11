import React, { useEffect, useState } from 'react';
import { shiftsAPI } from '../../services/api';
import { formatCedis, formatDateTime } from '../../utils/format';
import toast from 'react-hot-toast';

export default function ShiftManager() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCurrent = async () => {
    try { const r = await shiftsAPI.getCurrent(); setCurrentShift(r.data); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const r = await shiftsAPI.getHistory();
      setShiftHistory(r.data);
    } catch (e) { console.error(e); toast.error('Failed to load shift history'); }
    setLoadingHistory(false);
  };

  useEffect(() => { loadCurrent(); }, []);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const startShift = async () => {
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) { toast.error('Enter valid opening cash'); return; }
    try {
      await shiftsAPI.start(cash);
      toast.success('Shift started');
      setOpeningCash('');
      loadCurrent();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  const closeShift = async () => {
    if (!currentShift) return;
    const cash = parseFloat(closingCash);
    if (isNaN(cash)) { toast.error('Enter closing cash amount'); return; }
    try {
      const r = await shiftsAPI.close(currentShift.id, cash);
      toast.success(`Shift closed. Difference: ${formatCedis(r.data.difference)}`);
      setClosingCash('');
      loadCurrent();
    } catch (error: any) { toast.error(error.response?.data?.error || 'Failed'); }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shift Management</h1>

      <div className="flex gap-2">
        <button onClick={() => setTab('current')}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'current' ? 'bg-lion-gold text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          Current Shift
        </button>
        <button onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'history' ? 'bg-lion-gold text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          Shift History
        </button>
      </div>

      {tab === 'current' && (
        <>
          {!currentShift ? (
            <div className="card max-w-md">
              <h2 className="text-lg font-bold mb-4">Start New Shift</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Opening Cash (GHS)</label>
                  <input type="number" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)}
                    className="input-field" placeholder="e.g. 500.00" />
                </div>
                <button onClick={startShift} className="btn-primary w-full">Start Shift</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                  <p className="text-gray-400 text-sm">Shift Started</p>
                  <p className="font-bold">{formatDateTime(currentShift.start_time)}</p>
                </div>
                <div className="card">
                  <p className="text-gray-400 text-sm">Opening Cash</p>
                  <p className="font-bold text-lion-gold">{formatCedis(currentShift.opening_cash)}</p>
                </div>
                <div className="card">
                  <p className="text-gray-400 text-sm">Sales This Shift</p>
                  <p className="font-bold">{currentShift.sales_summary?.transaction_count || 0} transactions</p>
                  <p className="text-lion-gold">{formatCedis(currentShift.sales_summary?.total_sales || 0)}</p>
                </div>
              </div>

              {/* Payment Breakdown */}
              {currentShift.payment_breakdown && currentShift.payment_breakdown.length > 0 && (
                <div className="card">
                  <h3 className="font-bold mb-2">Payment Breakdown</h3>
                  <div className="flex gap-4">
                    {currentShift.payment_breakdown.map((p: any) => (
                      <div key={p.payment_method} className="bg-gray-800 px-3 py-2 rounded">
                        <p className="text-xs text-gray-400 capitalize">{p.payment_method.replace('_', ' ')}</p>
                        <p className="font-bold">{formatCedis(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card max-w-md">
                <h2 className="text-lg font-bold mb-4">Close Shift</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Closing Cash (GHS)</label>
                    <input type="number" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)}
                      className="input-field" placeholder="Count and enter cash in drawer" />
                  </div>
                  <button onClick={closeShift} className="btn-danger w-full">Close Shift</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div>
          {loadingHistory ? (
            <p>Loading...</p>
          ) : shiftHistory.length === 0 ? (
            <p className="text-gray-400">No shift history found.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">Cashier</th>
                    <th className="text-left py-2">Start Time</th>
                    <th className="text-left py-2">End Time</th>
                    <th className="text-right py-2">Opening Cash</th>
                    <th className="text-right py-2">Closing Cash</th>
                    <th className="text-right py-2">Expected</th>
                    <th className="text-right py-2">Difference</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftHistory.map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-800">
                      <td className="py-2">{s.cashier_name || 'Unknown'}</td>
                      <td className="py-2">{formatDateTime(s.start_time)}</td>
                      <td className="py-2">{s.end_time ? formatDateTime(s.end_time) : '-'}</td>
                      <td className="py-2 text-right">{formatCedis(s.opening_cash)}</td>
                      <td className="py-2 text-right">{s.closing_cash ? formatCedis(s.closing_cash) : '-'}</td>
                      <td className="py-2 text-right">{s.expected_cash ? formatCedis(s.expected_cash) : '-'}</td>
                      <td className={`py-2 text-right font-bold ${
                        s.difference && s.difference !== 0 ? (s.difference > 0 ? 'text-green-400' : 'text-red-400') : ''
                      }`}>{s.difference !== null && s.difference !== undefined ? formatCedis(s.difference) : '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          s.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-300'
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
