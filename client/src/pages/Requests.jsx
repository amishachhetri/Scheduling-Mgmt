import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Mail, Phone, MapPin, AlertTriangle, Inbox, CalendarDays } from 'lucide-react';
import api from '../utils/api.js';
import { useApp } from '../context/AppContext.jsx';
import { formatCurrency, formatDate, formatTimeRange } from '../utils/helpers.js';
import Modal from '../components/Modal.jsx';
import ApproveRequestModal from '../components/ApproveRequestModal.jsx';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { refresh } = useApp();

  const load = useCallback(() => {
    api.get('/admin/requests').then(r => { setRequests(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApproved = (id) => {
    setRequests(rs => rs.filter(r => r.id !== id));
    setApproveTarget(null);
    refresh();
  };

  const confirmDeny = async () => {
    if (!denyTarget) return;
    setBusyId(denyTarget.id);
    try {
      await api.post(`/admin/requests/${denyTarget.id}/deny`, { reason: denyReason });
      toast.success('Request declined');
      setRequests(rs => rs.filter(r => r.id !== denyTarget.id));
      refresh();
    } catch {
      toast.error('Failed to deny request');
    } finally {
      setBusyId(null);
      setDenyTarget(null);
      setDenyReason('');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Requests</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Booking requests from your website, waiting on you.</p>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
            <Inbox className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-400">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold dark:text-white">{r.client_name} — {r.shoot_type}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {r.client_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.client_email}</span>}
                    {r.client_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.client_phone}</span>}
                  </div>
                </div>
                {r.has_conflict && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Date conflict
                  </span>
                )}
              </div>

              {r.shoot_type === 'Other' && r.shoot_type_detail && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20 -mx-4 px-4 py-2.5">
                  <p className="text-xs text-purple-700 dark:text-purple-400 uppercase tracking-wide font-semibold">What they're looking for</p>
                  <p className="text-sm dark:text-white mt-0.5">{r.shoot_type_detail}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                  <p className="dark:text-white">
                    {formatDate(r.shoot_date)}, {formatTimeRange(r.shoot_time, r.shoot_end_time)}
                    {r.shoot_type !== 'Other' && r.shoot_type_detail && <span className="text-gray-500 dark:text-gray-400"> — {r.shoot_type_detail}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Location</p>
                  <p className="dark:text-white flex items-center gap-1">{r.location ? <><MapPin className="w-3 h-3 shrink-0" /> {r.location}</> : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Package</p>
                  <p className="dark:text-white">{r.package_name || (r.shoot_type === 'Other' ? 'Custom request' : '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Price</p>
                  <p className="dark:text-white">{r.shoot_type === 'Other' ? 'To be quoted' : formatCurrency(r.package_price)}</p>
                </div>
              </div>

              {r.events?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <CalendarDays className="w-3 h-3" /> Additional days
                  </p>
                  <ul className="text-sm dark:text-white space-y-0.5">
                    {r.events.map(ev => (
                      <li key={ev.id}>{formatDate(ev.event_date)} — {ev.event_name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {r.notes && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">{r.notes}</p>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => setApproveTarget(r)} disabled={busyId === r.id}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white py-2 rounded-xl text-sm font-medium transition-colors">
                  Approve request
                </button>
                <button onClick={() => { setDenyTarget(r); setDenyReason(''); }} disabled={busyId === r.id}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-600 dark:text-gray-300 py-2 rounded-xl text-sm font-medium transition-colors">
                  Deny…
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!denyTarget} onClose={() => setDenyTarget(null)} title="Deny Request">
        <div className="space-y-3">
          <p className="text-sm dark:text-gray-300">
            Deny the request from <strong>{denyTarget?.client_name}</strong> for {denyTarget && formatDate(denyTarget.shoot_date)}?
            They'll get a polite email letting them know.
          </p>
          <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)}
            rows={3} placeholder="Optional — e.g. Already booked that day"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDenyTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={confirmDeny}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white">
              Deny Request
            </button>
          </div>
        </div>
      </Modal>

      <ApproveRequestModal request={approveTarget} onClose={() => setApproveTarget(null)} onApproved={handleApproved} />
    </div>
  );
}
