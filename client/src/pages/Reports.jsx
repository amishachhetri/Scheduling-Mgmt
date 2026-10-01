import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api.js';
import { formatCurrency } from '../utils/helpers.js';
import { useApp } from '../context/AppContext.jsx';

const PERIODS = [
  { key: 'mtd', label: 'This Month' },
  { key: 'ytd', label: 'This Year' },
  { key: 'overall', label: 'All Time' }
];

export default function Reports() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();
  const { darkMode } = useApp();
  const gridColor = darkMode ? '#374151' : '#f0f0f0'; // gray-700 / gray-100
  const tickColor = darkMode ? '#9ca3af' : '#6b7280'; // gray-400 / gray-500

  const load = () => {
    setLoadError(false);
    api.get('/dashboard/business').then(r => setData(r.data)).catch(() => setLoadError(true));
  };

  useEffect(() => { load(); }, []);

  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-gray-500 dark:text-gray-400">Couldn't load reports. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
    </div>
  );
  if (!data) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">How the business is doing overall — not a daily view.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {PERIODS.map(({ key, label }) => {
          const p = data[key];
          return (
            <div key={key} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold dark:text-white text-sm mb-3">{label}</h2>
              <div className="space-y-1.5 text-sm">
                <Row label="Income" value={p.income} color="text-green-600" />
                <Row label="Expenses" value={-p.expenses} color="text-red-500" />
                <Row label="Second Shooter Pay" value={-p.second_shooter_payments} color="text-red-500" />
                <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 mt-1.5">
                  <Row label="Net Profit" value={p.net_profit} color="text-sky-600 font-bold" bold />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold mb-4 dark:text-white text-sm">Monthly Income</h2>
        {data.monthly_income.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No income data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthly_income}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} />
              <YAxis tick={{ fontSize: 11, fill: tickColor }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)}
                contentStyle={darkMode ? { background: '#1f2937', border: '1px solid #374151', color: '#fff' } : undefined} />
              <Area type="monotone" dataKey="income" stroke="#0ea5e9" fill={darkMode ? '#0c4a6e' : '#e0f2fe'} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Need the annual tax breakdown or a CSV export?{' '}
        <button onClick={() => navigate('/admin/settings?tab=finances')} className="text-sky-600 hover:underline">
          Settings → Finances
        </button>
      </p>
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-gray-600 dark:text-gray-400 ${bold ? 'font-medium' : ''}`}>{label}</span>
      <span className={`tabular-nums ${color}`}>{value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}</span>
    </div>
  );
}
