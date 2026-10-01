import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, Calendar, RefreshCw, X, ChevronDown } from 'lucide-react';
import api from '../utils/api.js';
import { formatDate, formatTime, formatCurrency, SHOOT_TYPES, BOOKING_STATUSES, displayShootType } from '../utils/helpers.js';
import { StageBadge, StatusBadge } from '../components/Badge.jsx';
import CancelModal from '../components/CancelModal.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';
import { useApp } from '../context/AppContext.jsx';
import toast from 'react-hot-toast';

function useClickOutside(ref, cb) {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

// ── Status-change popover ─────────────────────────────────────────────────────
function StatusPopover({ booking, onChanged }) {
  const [open, setOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const { refresh } = useApp();

  const changeStatus = async (newStatus) => {
    if (newStatus === 'Cancelled') { setOpen(false); setCancelModal(true); return; }
    try {
      await api.put(`/bookings/${booking.id}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      refresh();
      onChanged();
    } catch { toast.error('Failed to update status'); }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="focus:outline-none">
        <StatusBadge status={booking.status} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
          {BOOKING_STATUSES.map(s => (
            <button key={s} onClick={e => { e.stopPropagation(); changeStatus(s); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${booking.status === s ? 'font-semibold text-sky-600' : 'dark:text-gray-200'}`}>
              {s}
            </button>
          ))}
          <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
            <button onClick={e => { e.stopPropagation(); changeStatus('Cancelled'); }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
              Cancel booking
            </button>
          </div>
        </div>
      )}

      <CancelModal booking={booking} open={cancelModal} onClose={() => setCancelModal(false)} onCancelled={onChanged} />
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, onChanged, onReschedule }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-sky-200 dark:hover:border-sky-800 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0" onClick={() => navigate(`/admin/bookings/${booking.id}`)} style={{ cursor: 'pointer' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold dark:text-white">{booking.client_name}</p>
            <StatusPopover booking={booking} onChanged={onChanged} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayShootType(booking)} · {formatDate(booking.shoot_date)}
            {booking.shoot_time && ` at ${formatTime(booking.shoot_time)}`}
            {booking.shoot_end_time && ` – ${formatTime(booking.shoot_end_time)}`}
          </p>
          {booking.location && <p className="text-xs text-gray-400 mt-0.5">{booking.location}</p>}
        </div>
        <div className="text-right shrink-0 flex items-start gap-2">
          <div>
            <p className="font-semibold dark:text-white text-sm">{formatCurrency(booking.package_price)}</p>
            {booking.balance_due > 0 && <p className="text-xs text-amber-600">{formatCurrency(booking.balance_due)} owed</p>}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 mt-0.5 cursor-pointer" onClick={() => navigate(`/admin/bookings/${booking.id}`)} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <StageBadge stage={booking.workflow_stage} />
        {booking.status !== 'Cancelled' && (
          <button onClick={() => onReschedule(booking)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-sky-600 transition-colors">
            <RefreshCw className="w-3 h-3" /> Reschedule
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [shootTypeFilter, setShootTypeFilter] = useState('');
  const [upcomingSort, setUpcomingSort] = useState('date');
  const [pastYear, setPastYear] = useState('');
  const [pastMonth, setPastMonth] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    api.get('/bookings?sort=date').then(r => {
      setBookings(r.data);
      setLoadError(false);
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().split('T')[0];

  // Filter by search + shoot type. Pending/denied requests live in the Requests inbox, not here.
  const allFiltered = bookings.filter(b => {
    if (b.status === 'Requested' || b.status === 'Denied') return false;
    const matchSearch = !search ||
      (b.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.shoot_type || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.location || '').toLowerCase().includes(search.toLowerCase());
    const matchType = !shootTypeFilter || b.shoot_type === shootTypeFilter;
    return matchSearch && matchType;
  });

  // Split
  const upcoming = allFiltered.filter(b => b.shoot_date >= today && b.status !== 'Cancelled');
  const past = allFiltered.filter(b => b.shoot_date < today || b.status === 'Cancelled');

  // Sort upcoming
  const sortedUpcoming = [...upcoming].sort((a, b) => {
    if (upcomingSort === 'recent') {
      const ta = a.updated_at || a.created_at || '';
      const tb = b.updated_at || b.created_at || '';
      return tb.localeCompare(ta);
    }
    return a.shoot_date.localeCompare(b.shoot_date);
  });

  // Filter past by year/month
  const filteredPast = past.filter(b => {
    if (pastYear && !b.shoot_date.startsWith(pastYear)) return false;
    if (pastMonth && b.shoot_date.slice(5, 7) !== pastMonth) return false;
    return true;
  }).sort((a, b) => b.shoot_date.localeCompare(a.shoot_date));

  // Build year options from past bookings
  const pastYears = [...new Set(past.map(b => b.shoot_date?.slice(0, 4)).filter(Boolean))].sort((a,b) => b-a);
  const months = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' },
    { value: '03', label: 'March' }, { value: '04', label: 'April' },
    { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' },
    { value: '09', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Bookings</h1>
        <button onClick={() => navigate('/admin/bookings/new')}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {/* Global filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <select value={shootTypeFilter} onChange={e => setShootTypeFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
          <option value="">All Types</option>
          {SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : loadError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-gray-500 dark:text-gray-400">Couldn't load bookings. Check your connection and try again.</p>
          <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Upcoming ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-500" />
                Upcoming
                <span className="text-sm font-normal text-gray-400">({sortedUpcoming.length})</span>
              </h2>
              <select value={upcomingSort} onChange={e => setUpcomingSort(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
                <option value="date">Upcoming first</option>
                <option value="recent">Recent activity</option>
              </select>
            </div>

            {sortedUpcoming.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-700">
                <p className="text-gray-400 text-sm mb-2">No upcoming bookings</p>
                <button onClick={() => navigate('/admin/bookings/new')} className="text-sky-600 hover:underline text-sm">
                  Schedule a shoot →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedUpcoming.map(b => (
                  <BookingCard key={b.id} booking={b} onChanged={load}
                    onReschedule={setRescheduleTarget} />
                ))}
              </div>
            )}
          </section>

          {/* ── Past ── */}
          <section>
            <button
              onClick={() => setPastOpen(o => !o)}
              className="flex items-center gap-3 flex-wrap w-full mb-2 text-left group">
              <h2 className="text-base font-bold dark:text-white flex items-center gap-1.5">
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pastOpen ? '' : '-rotate-90'}`} />
                Past
                <span className="text-sm font-normal text-gray-400">({filteredPast.length})</span>
              </h2>
              {pastOpen && pastYears.length > 0 && (
                <div className="flex gap-2 ml-auto" onClick={e => e.stopPropagation()}>
                  <select value={pastYear} onChange={e => { setPastYear(e.target.value); setPastMonth(''); }}
                    className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
                    <option value="">All years</option>
                    {pastYears.map(y => <option key={y}>{y}</option>)}
                  </select>
                  <select value={pastMonth} onChange={e => setPastMonth(e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
                    <option value="">All months</option>
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              )}
            </button>

            {pastOpen && (
              filteredPast.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-700">
                  <p className="text-gray-400 text-sm">No past bookings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPast.map(b => (
                    <BookingCard key={b.id} booking={b} onChanged={load}
                      onReschedule={setRescheduleTarget} />
                  ))}
                </div>
              )
            )}
          </section>
        </div>
      )}

      <RescheduleModal
        booking={rescheduleTarget}
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={load}
      />
    </div>
  );
}
