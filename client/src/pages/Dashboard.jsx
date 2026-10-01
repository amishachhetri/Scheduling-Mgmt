import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DollarSign, HandCoins, Landmark, Plus, Calendar, ChevronRight, ChevronDown, Camera, Clock, Inbox, ArrowRight, Check } from 'lucide-react';
import api from '../utils/api.js';
import { formatCurrency, formatDate, formatTimeRange, WORKFLOW_STAGES } from '../utils/helpers.js';
import { StageBadge } from '../components/Badge.jsx';
import { useApp } from '../context/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import ApproveRequestModal from '../components/ApproveRequestModal.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [statModal, setStatModal] = useState(null); // 'bookings' | 'other' | 'owe' | 'week' | null
  const [moneyOwedRows, setMoneyOwedRows] = useState([]);
  const [secondShooterRows, setSecondShooterRows] = useState([]);
  const [statLoading, setStatLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const navigate = useNavigate();
  const { dataVersion, refresh, requests } = useApp();
  const topRequests = requests.slice(0, 3);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
      setLoadError(false);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }, []);

  // Refetch on mount, on dataVersion change, and every 30s. Requests come from AppContext (which
  // already fetches/polls them for the nav badge) rather than a second fetch of the same data.
  useEffect(() => { load(); }, [load, dataVersion]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleApproved = (id) => {
    setApproveTarget(null);
    refresh();
  };

  const denyRequest = async (req) => {
    setBusyId(req.id);
    try {
      await api.post(`/admin/requests/${req.id}/deny`);
      toast.success('Request declined');
      refresh();
    } catch { toast.error('Failed to deny request'); }
    finally { setBusyId(null); }
  };

  const advanceStage = async (project) => {
    const idx = WORKFLOW_STAGES.indexOf(project.workflow_stage);
    const nextStage = WORKFLOW_STAGES[idx + 1];
    if (!nextStage) return;
    setBusyId(project.id);
    try {
      await api.put(`/bookings/${project.id}/workflow`, { stage: nextStage });
      toast.success(`${project.client_name} → ${nextStage}`);
      load();
      refresh();
    } catch { toast.error('Failed to advance stage'); }
    finally { setBusyId(null); }
  };

  const openMoneyModal = async (type) => {
    setStatModal(type);
    setStatLoading(true);
    try {
      const res = await api.get('/money-owed?paid=false');
      setMoneyOwedRows(res.data.filter(r => (type === 'other') === (r.type === 'manual')));
    } catch { toast.error('Failed to load'); }
    finally { setStatLoading(false); }
  };

  const openOweModal = async () => {
    setStatModal('owe');
    setStatLoading(true);
    try {
      const res = await api.get('/second-shooters');
      setSecondShooterRows(res.data.filter(r => !r.paid));
    } catch { toast.error('Failed to load'); }
    finally { setStatLoading(false); }
  };

  const markMoneyOwedPaid = async (id) => {
    setPayingId(id);
    try {
      await api.put(`/money-owed/${id}/pay`);
      toast.success('Marked as paid');
      setMoneyOwedRows(rows => rows.filter(r => r.id !== id));
      load();
      refresh();
    } catch { toast.error('Failed to update'); }
    finally { setPayingId(null); }
  };

  const markSecondShooterPaid = async (id) => {
    setPayingId(id);
    try {
      await api.put(`/second-shooters/${id}/pay`);
      toast.success('Marked as paid');
      setSecondShooterRows(rows => rows.filter(r => r.id !== id));
      load();
      refresh();
    } catch { toast.error('Failed to update'); }
    finally { setPayingId(null); }
  };

  const closeStatModal = () => setStatModal(null);

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;
  if (loadError || !data) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-gray-500 dark:text-gray-400">Couldn't load the dashboard. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Overview</h1>
        <button onClick={() => navigate('/admin/bookings/new')}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {topRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold dark:text-white text-sm flex items-center gap-2">
              <Inbox className="w-4 h-4 text-sky-600" />
              New requests
              <span className="bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {data.pending_requests} waiting
              </span>
            </h2>
            <button onClick={() => navigate('/admin/requests')} className="text-xs text-sky-600 hover:underline">View all →</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {topRequests.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400 text-xs font-bold">
                  {r.client_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{r.client_name} — {r.shoot_type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.shoot_date)}, {formatTimeRange(r.shoot_time, r.shoot_end_time)}{r.location ? ` · ${r.location}` : ''}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setApproveTarget(r)} disabled={busyId === r.id}
                    className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    Approve
                  </button>
                  <button onClick={() => denyRequest(r)} disabled={busyId === r.id}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium">
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards -- day-to-day money only. Overall/YTD income lives on the Reports page. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Owed to You (Bookings)"
          value={formatCurrency(data.money_owed_bookings)}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-900/20"
          onClick={() => openMoneyModal('bookings')}
        />
        <StatCard
          label="Owed to You (Other)"
          value={formatCurrency(data.money_owed_manual)}
          icon={<HandCoins className="w-4 h-4" />}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-900/20"
          onClick={() => openMoneyModal('other')}
        />
        <StatCard
          label="You Owe"
          value={formatCurrency(data.money_owed_by_him)}
          icon={<Landmark className="w-4 h-4" />}
          color="text-rose-600"
          bg="bg-rose-50 dark:bg-rose-900/20"
          onClick={openOweModal}
        />
        <StatCard
          label="Shoots This Month"
          value={data.upcoming_this_month}
          icon={<Calendar className="w-4 h-4" />}
          color="text-sky-600"
          bg="bg-sky-50 dark:bg-sky-900/20"
          onClick={() => setStatModal('week')}
        />
      </div>

      {/* Active projects -- the main "what needs my attention" list */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold mb-3 dark:text-white text-sm">Active Projects</h2>
        {data.active_projects.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No active projects</p>
        ) : (
          <div className="space-y-2">
            {data.active_projects.map(p => {
              const idx = WORKFLOW_STAGES.indexOf(p.workflow_stage);
              const nextStage = WORKFLOW_STAGES[idx + 1];
              return (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <button onClick={() => navigate(`/admin/bookings/${p.id}`)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm dark:text-white truncate">{p.client_name}</p>
                      <p className="text-xs text-gray-400">{p.shoot_type} · {formatDate(p.shoot_date)}{p.balance_due > 0 ? ` · ${formatCurrency(p.balance_due)} due` : ''}</p>
                    </div>
                    <StageBadge stage={p.workflow_stage} />
                  </button>
                  {nextStage && (
                    <button onClick={() => advanceStage(p)} disabled={busyId === p.id}
                      className="shrink-0 flex items-center gap-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 disabled:opacity-60 text-sky-600 dark:text-sky-400 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                      <ArrowRight className="w-3 h-3" /> {nextStage}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.past_projects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button onClick={() => setShowPast(s => !s)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`} />
              Past projects ({data.past_projects.length})
            </button>
            {showPast && (
              <div className="mt-2 space-y-1">
                {data.past_projects.map(p => (
                  <button key={p.id} onClick={() => navigate(`/admin/bookings/${p.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm dark:text-gray-200 truncate">{p.client_name}</p>
                      <p className="text-xs text-gray-400">{p.shoot_type} · {formatDate(p.shoot_date)}</p>
                    </div>
                    <StageBadge stage={p.workflow_stage} />
                  </button>
                ))}
                <button onClick={() => navigate('/admin/bookings')} className="text-xs text-sky-600 hover:underline mt-1">
                  View all bookings →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming + activity */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold mb-3 dark:text-white text-sm">Upcoming This Month</h2>
          <div className="space-y-1">
            {data.upcoming_shoots.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No shoots in the next 4 weeks</p>
            ) : data.upcoming_shoots.map(b => (
              <button key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex flex-col items-center justify-center shrink-0 leading-none">
                  <span className="text-sky-600 dark:text-sky-400 text-[9px] font-semibold uppercase">
                    {new Date(b.shoot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 text-xs font-bold">
                    {new Date(b.shoot_date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm dark:text-white truncate">{b.client_name}</p>
                  <p className="text-xs text-gray-400">{b.shoot_type} · {formatTimeRange(b.shoot_time, b.shoot_end_time)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StageBadge stage={b.workflow_stage} />
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold mb-3 dark:text-white text-sm">Recent Activity</h2>
          <div className="space-y-2.5">
            {data.recent_activity.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No recent activity</p>
            ) : data.recent_activity.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  a.type === 'booking' ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  {a.type === 'booking'
                    ? <Camera className="w-3 h-3 text-sky-600" />
                    : <Clock className="w-3 h-3 text-purple-600" />
                  }
                </div>
                <div className="flex-1 min-w-0 dark:text-gray-300">
                  <span className="font-medium">{a.client_name}</span>
                  <span className="text-gray-400">
                    {a.type === 'booking' ? ` — ${a.shoot_type}` : ` — ${a.template_type?.replace(/_/g, ' ')}`}
                  </span>
                  <span className="text-gray-400 ml-1 text-xs">{new Date(a.ts).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Owed to You (Bookings / Other) */}
      <Modal open={statModal === 'bookings' || statModal === 'other'} onClose={closeStatModal}
        title={statModal === 'other' ? 'Owed to You (Other)' : 'Owed to You (Bookings)'}>
        {statLoading ? (
          <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
        ) : moneyOwedRows.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nothing outstanding</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {moneyOwedRows.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatCurrency(r.amount)}
                    {r.shoot_type ? ` · ${r.shoot_type}` : ''}
                    {r.shoot_date ? ` · ${formatDate(r.shoot_date)}` : ''}
                    {r.due_date ? ` · due ${formatDate(r.due_date)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.booking_id && (
                    <button onClick={() => navigate(`/admin/bookings/${r.booking_id}`)} className="text-xs text-sky-600 hover:underline">
                      View
                    </button>
                  )}
                  <button onClick={() => markMoneyOwedPaid(r.id)} disabled={payingId === r.id}
                    className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 disabled:opacity-60 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                    <Check className="w-3 h-3" /> Mark as Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* You Owe (second shooters / assistants) */}
      <Modal open={statModal === 'owe'} onClose={closeStatModal} title="You Owe">
        {statLoading ? (
          <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
        ) : secondShooterRows.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nothing outstanding</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {secondShooterRows.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatCurrency(r.pay_amount)} · {r.role} · {r.client_name} — {r.shoot_type} · {formatDate(r.shoot_date)}
                  </p>
                </div>
                <button onClick={() => markSecondShooterPaid(r.id)} disabled={payingId === r.id}
                  className="shrink-0 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 disabled:opacity-60 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                  <Check className="w-3 h-3" /> Mark as Paid
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Shoots This Month */}
      <Modal open={statModal === 'week'} onClose={closeStatModal} title="Shoots This Month">
        {data.upcoming_shoots.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No shoots in the next 4 weeks</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.upcoming_shoots.map(b => (
              <button key={b.id} onClick={() => { closeStatModal(); navigate(`/admin/bookings/${b.id}`); }}
                className="w-full text-left flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                  <span className="text-sky-600 dark:text-sky-400 text-xs font-bold">
                    {new Date(b.shoot_date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm dark:text-white truncate">{b.client_name}</p>
                  <p className="text-xs text-gray-400">{b.shoot_type} · {formatDate(b.shoot_date)} · {formatTimeRange(b.shoot_time, b.shoot_end_time)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StageBadge stage={b.workflow_stage} />
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <ApproveRequestModal request={approveTarget} onClose={() => setApproveTarget(null)} onApproved={handleApproved} />
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, onClick }) {
  const Wrap = onClick ? 'button' : 'div';
  return (
    <Wrap onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-left w-full ${onClick ? 'hover:border-sky-300 dark:hover:border-sky-700 transition-colors cursor-pointer' : ''}`}>
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl mb-2 ${bg} ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </Wrap>
  );
}
