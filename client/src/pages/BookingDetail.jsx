import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Link, Mail, Phone, MapPin, ChevronRight, Plus, Check, RefreshCw, Download, History } from 'lucide-react';
import api from '../utils/api.js';
import { formatDate, formatTime, formatCurrency, WORKFLOW_STAGES, BOOKING_STATUSES, displayShootType } from '../utils/helpers.js';
import { StageBadge, StatusBadge } from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';
import CancelModal from '../components/CancelModal.jsx';
import GalleryCard from '../components/GalleryCard.jsx';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext.jsx';

function useClickOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = useApp();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stageModal, setStageModal] = useState(false);
  const [stageNote, setStageNote] = useState('');
  const [galleryLink, setGalleryLink] = useState('');
  const [galleryModal, setGalleryModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [sendTemplate, setSendTemplate] = useState('booking_confirmation');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  // Status popover
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  useClickOutside(statusRef, () => setStatusOpen(false));
  // Cancel modal
  const [cancelModal, setCancelModal] = useState(false);
  // Reschedule modal
  const [rescheduleModal, setRescheduleModal] = useState(false);

  const load = useCallback(() => {
    api.get(`/bookings/${id}`).then(r => {
      setBooking(r.data);
      setLoadError(false);
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const advanceStage = async (stage) => {
    if (stage === 'Final products delivered' && !booking.gallery_link) {
      setStageModal(false);
      setGalleryModal(true);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/bookings/${id}/workflow`, { stage, note: stageNote || undefined });
      toast.success('Stage updated');
      setStageModal(false);
      setStageNote('');
      load();
      refresh();
    } catch { toast.error('Failed to update stage'); }
    setBusy(false);
  };

  const saveGallery = async () => {
    if (!galleryLink) return toast.error('Enter a gallery link');
    setBusy(true);
    try {
      await api.put(`/bookings/${id}/workflow`, {
        stage: 'Final products delivered',
        gallery_link: galleryLink,
        note: stageNote || undefined
      });
      toast.success('Gallery saved and client notified!');
      setGalleryModal(false);
      setGalleryLink('');
      load();
      refresh();
    } catch { toast.error('Failed to save gallery'); }
    setBusy(false);
  };

  const deleteBooking = async () => {
    setBusy(true);
    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Booking deleted');
      refresh();
      navigate('/admin/bookings');
    } catch {
      toast.error('Failed to delete booking');
      setDeleteModal(false);
      setBusy(false);
    }
  };

  const changeStatus = async (newStatus) => {
    if (newStatus === 'Cancelled') { setStatusOpen(false); setCancelModal(true); return; }
    try {
      await api.put(`/bookings/${id}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      load(); refresh();
    } catch { toast.error('Failed to update status'); }
    setStatusOpen(false);
  };

  const markAssistantPaid = async (ssId) => {
    try {
      await api.put(`/second-shooters/${ssId}/pay`);
      toast.success('Assistant marked as paid');
      load();
      refresh();
    } catch { toast.error('Failed to update'); }
  };

  const sendMessage = async () => {
    try {
      await api.post(`/messages/send/${id}`, { template_type: sendTemplate });
      toast.success('Message sent (or logged)');
      setSendModal(false);
      load();
    } catch { toast.error('Failed to send'); }
  };

  // Only the fields this form actually edits -- editForm was seeded from the full booking
  // (including joined arrays like second_shooters, workflow_notes, messages), and sending those
  // back as-is would hit PUT /bookings/:id's own second_shooters handling, which deletes and
  // reinserts every second shooter (losing their paid/paid_at status and ids) even though this
  // form never touched them.
  const saveEdit = async () => {
    setBusy(true);
    try {
      const { shoot_date, status, shoot_time, shoot_end_time, location, package_price, discount, deposit_amount, deposit_received, contract_signed, notes } = editForm;
      await api.put(`/bookings/${id}`, { shoot_date, status, shoot_time, shoot_end_time, location, package_price, discount, deposit_amount, deposit_received, contract_signed, notes });
      toast.success('Booking updated');
      setEditModal(false);
      load();
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
    setBusy(false);
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;
  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-gray-500 dark:text-gray-400">Couldn't load this booking. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
    </div>
  );
  if (!booking) return <div className="text-center py-12 text-gray-400">Booking not found</div>;

  const currentStageIdx = WORKFLOW_STAGES.indexOf(booking.workflow_stage);
  const nextStage = WORKFLOW_STAGES[currentStageIdx + 1];
  const stageDate = booking.workflow_stage_updated_at ? new Date(booking.workflow_stage_updated_at) : null;
  const daysInStage = stageDate ? Math.round((Date.now() - stageDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Split workflow notes: regular vs reschedule/cancel history
  const regularNotes = (booking.workflow_notes || []).filter(n => n.stage !== 'rescheduled' && n.stage !== 'cancelled');
  const historyNotes = (booking.workflow_notes || []).filter(n => n.stage === 'rescheduled' || n.stage === 'cancelled');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold dark:text-white truncate">{booking.client_name}</h1>
          <p className="text-gray-500 text-sm">{displayShootType(booking)} · {formatDate(booking.shoot_date)}</p>
        </div>

        {/* Clickable status badge */}
        <div ref={statusRef} className="relative">
          <button onClick={() => setStatusOpen(o => !o)} className="focus:outline-none">
            <StatusBadge status={booking.status} />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
              {BOOKING_STATUSES.map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${booking.status === s ? 'font-semibold text-sky-600' : 'dark:text-gray-200'}`}>
                  {s}
                </button>
              ))}
              <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                <button onClick={() => changeStatus('Cancelled')}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Cancel booking
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2 flex-wrap">
        {booking.status !== 'Cancelled' && (
          <button onClick={() => setRescheduleModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Reschedule
          </button>
        )}
        <a href={`/api/ics/${id}`} download
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors">
          <Download className="w-3.5 h-3.5" /> Add to Calendar
        </a>
      </div>

      {/* Workflow stepper */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm dark:text-white">Workflow</h2>
          <span className="text-xs text-gray-400">{daysInStage}d in this stage</span>
        </div>

        {/* Vertical stepper — easier to read on mobile */}
        <div className="space-y-2">
          {WORKFLOW_STAGES.map((s, i) => {
            const done = i < currentStageIdx;
            const active = i === currentStageIdx;
            return (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-sm ${active ? 'font-semibold dark:text-white' : done ? 'text-gray-400 line-through' : 'text-gray-400 dark:text-gray-500'}`}>
                  {s}
                </span>
                {active && <span className="ml-auto text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 px-2 py-0.5 rounded-full font-medium">Current</span>}
              </div>
            );
          })}
        </div>

        {nextStage && (
          <button onClick={() => setStageModal(true)}
            className="w-full mt-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
            Advance to: {nextStage}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {regularNotes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {regularNotes.map(n => (
              <div key={n.id} className="text-xs bg-gray-50 dark:bg-gray-700/60 rounded-lg p-2.5">
                <span className="text-gray-400">[{n.stage}]</span>
                <span className="ml-1.5 dark:text-gray-300">{n.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm dark:text-white">Details</h2>
          <button onClick={() => { setEditForm({ ...booking }); setEditModal(true); }}
            className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <DetailRow label="Date" value={formatDate(booking.shoot_date)} />
          <DetailRow label="Time" value={`${formatTime(booking.shoot_time)}${booking.shoot_end_time ? ` – ${formatTime(booking.shoot_end_time)}` : ''}`} />
          {booking.location && <DetailRow label="Location" value={booking.location} full />}
          <DetailRow label="Package" value={booking.package_name} />
          <DetailRow label="Package Price" value={formatCurrency(booking.package_price)} />
          {(booking.discount > 0) && <DetailRow label="Discount" value={`-${formatCurrency(booking.discount)}`} className="text-green-600" />}

          {/* Deposit with inline toggle */}
          <dt className="text-xs text-gray-400">Deposit</dt>
          <dd className="flex items-center gap-2">
            <span className="text-sm dark:text-white font-medium">{formatCurrency(booking.deposit_amount)}</span>
            <button
              onClick={async () => {
                const next = !booking.deposit_received;
                await api.put(`/bookings/${id}`, { deposit_received: next });
                toast.success(next ? 'Deposit marked received' : 'Deposit marked pending');
                load(); refresh();
              }}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                booking.deposit_received
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200'
              }`}>
              {booking.deposit_received ? <><Check className="w-3 h-3" /> Received</> : 'Pending — tap to mark'}
            </button>
          </dd>

          <DetailRow label="Balance Due" value={formatCurrency(booking.balance_due)} className={booking.balance_due > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'} />
          <DetailRow label="Contract" value={booking.contract_signed ? 'Signed' : 'Not signed'} className={booking.contract_signed ? 'text-green-600' : 'text-gray-400'} />
        </dl>

        {/* Multi-day events */}
        {booking.events?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Multi-Day Events</p>
            <div className="space-y-1.5">
              {booking.events.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium dark:text-white">{ev.event_name}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{formatDate(ev.event_date)}{ev.event_time ? ` at ${formatTime(ev.event_time)}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {booking.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm dark:text-gray-300 whitespace-pre-wrap">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* Client contact */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-sm dark:text-white mb-3">Client Contact</h2>
        <div className="space-y-2">
          {booking.client_email && (
            <a href={`mailto:${booking.client_email}`} className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700">
              <Mail className="w-4 h-4" /> {booking.client_email}
            </a>
          )}
          {booking.client_phone && (
            <a href={`tel:${booking.client_phone}`} className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700">
              <Phone className="w-4 h-4" /> {booking.client_phone}
            </a>
          )}
          {booking.location && (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <MapPin className="w-4 h-4" /> {booking.location}
            </p>
          )}
        </div>
        <button onClick={() => setSendModal(true)}
          className="mt-3 w-full py-2 border border-sky-200 dark:border-sky-800 text-sky-600 rounded-xl text-sm font-medium hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex items-center justify-center gap-2">
          <Mail className="w-4 h-4" /> Send Message
        </button>
      </div>

      {/* Proofing gallery — client picks favorites before editing starts */}
      <GalleryCard bookingId={booking.id} type="proofing" />

      {/* Final photo delivery — via an external gallery service (Pixieset, ShootProof, etc.) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-sm dark:text-white mb-3">Final Gallery Delivery</h2>
        {booking.gallery_link ? (
          <div>
            <a href={booking.gallery_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sky-600 hover:text-sky-700 text-sm break-all">
              <Link className="w-4 h-4 shrink-0" />
              {booking.gallery_link}
            </a>
            {booking.gallery_delivered_at && (
              <p className="text-xs text-gray-400 mt-1">
                Delivered {new Date(booking.gallery_delivered_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <button onClick={() => setGalleryModal(true)}
            className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add gallery link
          </button>
        )}
      </div>

      {/* Assistants */}
      {booking.second_shooters?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-sm dark:text-white mb-3">Assistants</h2>
          {booking.second_shooters.map(ss => (
            <div key={ss.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div>
                <p className="font-medium text-sm dark:text-white">{ss.name}</p>
                <p className="text-xs text-gray-500">{ss.role} · {formatCurrency(ss.pay_amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                {!ss.paid && (
                  <button onClick={() => markAssistantPaid(ss.id)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium border border-green-200 dark:border-green-800 rounded-lg px-2 py-1 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                    <Check className="w-3 h-3" /> Mark Paid
                  </button>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ss.paid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {ss.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expenses */}
      <ExpensesSection bookingId={id} />

      {/* Reschedule / cancel history */}
      {historyNotes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-sm dark:text-white mb-3 flex items-center gap-1.5">
            <History className="w-4 h-4 text-gray-400" /> Change History
          </h2>
          <div className="space-y-2">
            {historyNotes.map(n => (
              <div key={n.id} className={`rounded-lg p-2.5 text-xs border-l-4 ${n.stage === 'cancelled' ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-sky-400 bg-sky-50 dark:bg-sky-900/10'}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-semibold uppercase tracking-wide ${n.stage === 'cancelled' ? 'text-red-600' : 'text-sky-600'}`}>
                    {n.stage === 'cancelled' ? 'Cancelled' : 'Rescheduled'}
                  </span>
                  {n.created_at && <span className="text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>}
                </div>
                {n.note && <p className="dark:text-gray-300 text-gray-600">{n.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {booking.messages?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-sm dark:text-white mb-3">Message History</h2>
          {booking.messages.map(m => (
            <div key={m.id} className="text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center justify-between">
                <span className="font-medium dark:text-gray-300">{m.template_type?.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-400">{new Date(m.sent_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">{m.subject}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                m.status === 'sent' ? 'bg-green-100 text-green-700' :
                m.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-red-100 dark:border-red-900/50">
        <h2 className="font-semibold text-sm text-red-600 mb-2">Danger Zone</h2>
        <button onClick={() => setDeleteModal(true)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
          <Trash2 className="w-4 h-4" /> Delete this booking
        </button>
      </div>

      {/* Stage advance modal */}
      <Modal open={stageModal} onClose={() => setStageModal(false)} title={`Advance to: ${nextStage}`}>
        <div className="space-y-4">
          <textarea value={stageNote} onChange={e => setStageNote(e.target.value)} rows={3}
            placeholder="Optional note for this stage..."
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm dark:bg-gray-700 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <div className="flex gap-3">
            <button onClick={() => setStageModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={() => advanceStage(nextStage)} disabled={busy} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">{busy ? 'Saving...' : 'Advance'}</button>
          </div>
        </div>
      </Modal>

      {/* Gallery modal */}
      <Modal open={galleryModal} onClose={() => setGalleryModal(false)} title="Add Gallery Link">
        <div className="space-y-4">
          <input type="url" value={galleryLink} onChange={e => setGalleryLink(e.target.value)}
            placeholder="https://pixieset.com/your-gallery"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <textarea value={stageNote} onChange={e => setStageNote(e.target.value)} rows={2}
            placeholder="Optional note..." className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <div className="flex gap-3">
            <button onClick={() => setGalleryModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={saveGallery} disabled={busy} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">{busy ? 'Saving...' : 'Save & Notify Client'}</button>
          </div>
        </div>
      </Modal>

      {/* Send message modal */}
      <Modal open={sendModal} onClose={() => setSendModal(false)} title="Send Message">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium dark:text-gray-300 mb-1 block">Template</label>
            <select value={sendTemplate} onChange={e => setSendTemplate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:outline-none">
              <option value="booking_confirmation">Booking Confirmation</option>
              <option value="payment_reminder">Payment Reminder</option>
              <option value="day_before_reminder">Day-Before Reminder</option>
              <option value="gallery_ready">Gallery Ready</option>
              <option value="review_request">Review Request</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">Will be logged. Emailed to {booking.client_email || '(no email)'} if SMTP is configured.</p>
          <div className="flex gap-3">
            <button onClick={() => setSendModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={sendMessage} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Send</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Booking?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete the booking for <strong>{booking.client_name}</strong> and all associated data.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={deleteBooking} disabled={busy} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> {busy ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      <RescheduleModal booking={booking} open={rescheduleModal} onClose={() => setRescheduleModal(false)} onRescheduled={load} />
      <CancelModal booking={booking} open={cancelModal} onClose={() => setCancelModal(false)} onCancelled={load} />

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Booking" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Date</label><input type="date" value={editForm.shoot_date || ''} onChange={e => setEditForm(f => ({ ...f, shoot_date: e.target.value }))} className={ed()} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Status</label>
              {/* 'Cancelled' is deliberately not a pickable option here -- cancelling only goes
                  through the dedicated Cancel flow (captures a note + deposit decision), never
                  this generic field editor. If the booking is already cancelled, it's shown as a
                  disabled option so the dropdown still displays it correctly. */}
              <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={ed()}>
                {BOOKING_STATUSES.map(s => <option key={s}>{s}</option>)}
                {editForm.status === 'Cancelled' && <option disabled>Cancelled</option>}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Start Time</label><input type="time" value={editForm.shoot_time || ''} onChange={e => setEditForm(f => ({ ...f, shoot_time: e.target.value }))} className={ed()} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">End Time</label><input type="time" value={editForm.shoot_end_time || ''} onChange={e => setEditForm(f => ({ ...f, shoot_end_time: e.target.value }))} className={ed()} /></div>
          </div>
          <div><label className="text-xs text-gray-400 mb-1 block">Location</label><input value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className={ed()} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Package Price</label><input type="number" value={editForm.package_price || ''} onChange={e => setEditForm(f => ({ ...f, package_price: e.target.value }))} className={ed()} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Discount</label><input type="number" value={editForm.discount || ''} onChange={e => setEditForm(f => ({ ...f, discount: e.target.value }))} className={ed()} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Deposit</label><input type="number" value={editForm.deposit_amount || ''} onChange={e => setEditForm(f => ({ ...f, deposit_amount: e.target.value }))} className={ed()} /></div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={!!editForm.deposit_received} onChange={e => setEditForm(f => ({ ...f, deposit_received: e.target.checked }))} className="w-4 h-4" />
              Deposit received
            </label>
            <label className="flex items-center gap-2 text-sm dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={!!editForm.contract_signed} onChange={e => setEditForm(f => ({ ...f, contract_signed: e.target.checked }))} className="w-4 h-4" />
              Contract signed
            </label>
          </div>
          <div><label className="text-xs text-gray-400 mb-1 block">Notes</label><textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={ed() + ' resize-none'} /></div>
          <div className="flex gap-3">
            <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">{busy ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, className = '', full }) {
  return (
    <>
      <dt className={`text-xs text-gray-400 ${full ? 'col-span-2' : ''}`}>{label}</dt>
      <dd className={`text-sm dark:text-white font-medium ${className} ${full ? 'col-span-2' : ''}`}>{value || '—'}</dd>
    </>
  );
}

function ed() {
  return 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500';
}

function ExpensesSection({ bookingId }) {
  const [expenses, setExpenses] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'General', mileage: '' });

  useEffect(() => {
    api.get(`/expenses?booking_id=${bookingId}`).then(r => setExpenses(r.data)).catch(() => {});
  }, [bookingId]);

  const add = async () => {
    if (!form.description || !form.amount) return;
    try {
      const res = await api.post('/expenses', { ...form, booking_id: bookingId });
      setExpenses(e => [res.data, ...e]);
      setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'General', mileage: '' });
      setOpen(false);
      toast.success('Expense added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add expense');
    }
  };

  const del = async (eid) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${eid}`);
      setExpenses(e => e.filter(x => x.id !== eid));
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm dark:text-white">Expenses & Mileage</h2>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {open && (
        <div className="space-y-2 mb-3 bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3">
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={ed2()} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Amount ($)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={ed2()} />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={ed2()} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={ed2()}>
              {['General', 'Travel', 'Equipment', 'Software', 'Marketing', 'Other'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Miles (optional)" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} className={ed2()} />
          </div>
          <button onClick={add} className="w-full py-2 bg-sky-600 text-white rounded-xl text-sm font-medium">Add</button>
        </div>
      )}
      {expenses.length === 0 ? (
        <p className="text-sm text-gray-400">No expenses logged</p>
      ) : (
        <div className="space-y-1.5">
          {expenses.map(e => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <div className="min-w-0">
                <span className="font-medium dark:text-white">{e.description}</span>
                <span className="text-gray-400 ml-2 text-xs">{e.category}</span>
                {e.mileage && <span className="text-gray-400 ml-2 text-xs">{e.mileage} mi</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium dark:text-gray-300 tabular-nums">{formatCurrency(e.amount)}</span>
                <button onClick={() => del(e.id)} className="text-gray-300 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm font-semibold dark:text-white">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ed2() {
  return 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500';
}
