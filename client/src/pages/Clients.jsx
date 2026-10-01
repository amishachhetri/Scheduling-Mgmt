import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mail, Phone, Image, User, ChevronRight, Plus, Download } from 'lucide-react';
import api from '../utils/api.js';
import { formatCurrency, SHOOT_TYPES } from '../utils/helpers.js';
import { StageBadge } from '../components/Badge.jsx';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [shootType, setShootType] = useState('');
  const navigate = useNavigate();

  // Debounced so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (shootType) params.set('shoot_type', shootType);
    api.get(`/clients?${params}`).then(r => {
      setClients(r.data);
      setLoadError(false);
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [debouncedSearch, shootType]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Clients</h1>
        <button onClick={() => window.open('/api/dashboard/export/clients', '_blank')}
          className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <select value={shootType} onChange={e => setShootType(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
          <option value="">All Types</option>
          {SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : loadError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-gray-500 dark:text-gray-400">Couldn't load clients. Check your connection and try again.</p>
          <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-400">No clients yet — create a booking to add one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(c => {
            const bookingUrl = `/admin/bookings/new?client_name=${encodeURIComponent(c.name)}&client_email=${encodeURIComponent(c.email || '')}&client_phone=${encodeURIComponent(c.phone || '')}`;
            return (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-sky-200 dark:hover:border-sky-800 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                    <p className="font-semibold dark:text-white">{c.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{c.total_shoots} shoot{c.total_shoots !== 1 ? 's' : ''}</span>
                      <span>Spent: {formatCurrency(c.total_spent)}</span>
                      {c.last_shoot_type && <span>{c.last_shoot_type}</span>}
                    </div>
                  </button>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(bookingUrl)}
                        className="flex items-center gap-1 text-xs bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg font-medium transition-colors">
                        <Plus className="w-3 h-3" /> Booking
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300 cursor-pointer" onClick={() => navigate(`/admin/clients/${c.id}`)} />
                    </div>
                    {c.outstanding_balance > 0 && (
                      <p className="text-xs font-semibold text-amber-600">{formatCurrency(c.outstanding_balance)} owed</p>
                    )}
                    {c.current_stage && <StageBadge stage={c.current_stage} />}
                    {c.gallery_link && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Image className="w-3 h-3" /> Gallery
                      </p>
                    )}
                  </div>
                </div>
                {c.last_message_sent && (
                  <p className="text-xs text-gray-400 mt-2">Last contact: {new Date(c.last_message_sent).toLocaleDateString()}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
