import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import api from '../utils/api.js';
import { SHOOT_TYPES, BOOKING_STATUSES, ASSISTANT_ROLES, defaultDepositForPackage } from '../utils/helpers.js';
import toast from 'react-hot-toast';
import Modal from '../components/Modal.jsx';

const MULTI_DAY_TYPE = 'Wedding (multi-day)';

const DEFAULT = {
  client_name: '', client_email: '', client_phone: '',
  shoot_type: 'Wedding (1 day)', shoot_type_detail: '', shoot_date: '', shoot_time: '10:00',
  shoot_end_time: '', location: '', package_id: '', package_name: '', package_price: '',
  discount: '', deposit_amount: '', deposit_received: false, notes: '', status: 'Upcoming'
};

export default function NewBooking() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    ...DEFAULT,
    shoot_date:   params.get('date') || '',
    client_name:  params.get('client_name') || '',
    client_email: params.get('client_email') || '',
    client_phone: params.get('client_phone') || '',
  });
  const [packages, setPackages] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [events, setEvents] = useState([{ event_name: 'Wedding Day', event_date: '', event_time: '' }]);
  const [conflicts, setConflicts] = useState([]);
  const [conflictModal, setConflictModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/packages').then(r => setPackages(r.data)).catch(() => {});
  }, []);

  // Auto-populate default package when shoot type changes
  useEffect(() => {
    if (!form.shoot_type) return;
    const match = packages.find(p => p.shoot_type === form.shoot_type && !p.archived);
    if (match) {
      setForm(f => ({ ...f, package_id: match.id, package_name: match.name, package_price: match.price, deposit_amount: defaultDepositForPackage(match) }));
    } else {
      setForm(f => ({ ...f, package_id: '', package_name: '', package_price: '' }));
    }
  }, [form.shoot_type, packages]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const price = parseFloat(form.package_price) || 0;
  const discount = parseFloat(form.discount) || 0;
  const deposit = parseFloat(form.deposit_amount) || 0;
  const balance = Math.max(0, price - discount - deposit);

  const handlePackageChange = (e) => {
    const pkg = packages.find(p => p.id === e.target.value);
    if (pkg) {
      setForm(f => ({ ...f, package_id: pkg.id, package_name: pkg.name, package_price: pkg.price, deposit_amount: defaultDepositForPackage(pkg) }));
    } else {
      setForm(f => ({ ...f, package_id: '', package_name: '', package_price: '' }));
    }
  };

  const addAssistant = () => setAssistants(a => [...a, { name: '', role: 'Assistant Photographer', pay_amount: '', pay_type: 'flat' }]);
  const updateAssistant = (i, k, v) => setAssistants(a => a.map((s, j) => j === i ? { ...s, [k]: v } : s));
  const removeAssistant = (i) => setAssistants(a => a.filter((_, j) => j !== i));

  const addEvent = () => setEvents(e => [...e, { event_name: '', event_date: '', event_time: '' }]);
  const updateEvent = (i, k, v) => setEvents(e => e.map((ev, j) => j === i ? { ...ev, [k]: v } : ev));
  const removeEvent = (i) => setEvents(e => e.filter((_, j) => j !== i));

  const doSubmit = useCallback(async (force = false) => {
    if (!form.client_name || !form.shoot_date || !form.shoot_time || !form.shoot_type) {
      toast.error('Fill in required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        second_shooters: assistants,
        events: form.shoot_type === MULTI_DAY_TYPE ? events : undefined
      };
      const res = await api.post('/bookings', payload);
      if (res.data.conflicts?.length > 0 && !force) {
        setConflicts(res.data.conflicts);
        setConflictModal(true);
        setSaving(false);
        return;
      }
      toast.success('Booking created!');
      navigate(`/admin/bookings/${res.data.booking.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create booking');
      setSaving(false);
    }
  }, [form, assistants, events, navigate]);

  const handleSubmit = (e) => { e.preventDefault(); doSubmit(false); };

  const isMultiDay = form.shoot_type === MULTI_DAY_TYPE;
  const isOther = form.shoot_type === 'Other';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold dark:text-white">New Booking</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client info */}
        <Section title="Client Info">
          <Field label="Client Name *">
            <input value={form.client_name} onChange={e => set('client_name', e.target.value)} required
              placeholder="Jane Smith" className={inp()} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)}
                placeholder="jane@email.com" className={inp()} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.client_phone} onChange={e => set('client_phone', e.target.value)}
                placeholder="(555) 000-0000" className={inp()} />
            </Field>
          </div>
        </Section>

        {/* Shoot Details */}
        <Section title="Shoot Details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shoot Type *">
              <select value={form.shoot_type} onChange={e => set('shoot_type', e.target.value)} className={inp()}>
                {SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inp()}>
                {BOOKING_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Other — specify */}
          {isOther && (
            <Field label="Specify shoot type">
              <input value={form.shoot_type_detail} onChange={e => set('shoot_type_detail', e.target.value)}
                placeholder="e.g. Boudoir, Headshots, Sports..." className={inp()} />
            </Field>
          )}

          {/* Single-day date + times */}
          {!isMultiDay && (
            <>
              <Field label="Date *">
                <input type="date" value={form.shoot_date} onChange={e => set('shoot_date', e.target.value)}
                  required className={inp()} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time *">
                  <input type="time" value={form.shoot_time} onChange={e => set('shoot_time', e.target.value)}
                    required className={inp()} />
                </Field>
                <Field label="End Time">
                  <input type="time" value={form.shoot_end_time} onChange={e => set('shoot_end_time', e.target.value)}
                    className={inp()} />
                </Field>
              </div>
            </>
          )}

          {/* Multi-day wedding events */}
          {isMultiDay && (
            <>
              <Field label="Primary Date (for calendar) *">
                <input type="date" value={form.shoot_date} onChange={e => set('shoot_date', e.target.value)}
                  required className={inp()} />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Events</label>
                  <button type="button" onClick={addEvent}
                    className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium">
                    <Plus className="w-3 h-3" /> Add event
                  </button>
                </div>
                <div className="space-y-2">
                  {events.map((ev, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Event Name">
                          <input value={ev.event_name} onChange={e => updateEvent(i, 'event_name', e.target.value)}
                            placeholder="e.g. Mehendi, Haldi, Wedding Day" className={inp()} />
                        </Field>
                        <Field label="Date">
                          <input type="date" value={ev.event_date} onChange={e => updateEvent(i, 'event_date', e.target.value)}
                            className={inp()} />
                        </Field>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field label="Time (optional)">
                            <input type="time" value={ev.event_time} onChange={e => updateEvent(i, 'event_time', e.target.value)}
                              className={inp()} />
                          </Field>
                        </div>
                        {events.length > 1 && (
                          <button type="button" onClick={() => removeEvent(i)}
                            className="p-2 text-gray-400 hover:text-red-500 mb-0.5">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Default Start Time *">
                  <input type="time" value={form.shoot_time} onChange={e => set('shoot_time', e.target.value)}
                    required className={inp()} />
                </Field>
                <Field label="Default End Time">
                  <input type="time" value={form.shoot_end_time} onChange={e => set('shoot_end_time', e.target.value)}
                    className={inp()} />
                </Field>
              </div>
            </>
          )}

          <Field label="Location">
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="Venue name or address" className={inp()} />
          </Field>
        </Section>

        {/* Package & Payment */}
        <Section title="Package & Payment">
          <Field label="Package">
            <select value={form.package_id} onChange={handlePackageChange} className={inp()}>
              <option value="">Custom / no package</option>
              {packages
                .filter(p => !p.archived)
                .sort((a, b) => (a.shoot_type === form.shoot_type ? -1 : 1))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.price}{p.shoot_type === form.shoot_type ? ' ★' : ''}
                  </option>
                ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Package Price">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.package_price}
                  onChange={e => set('package_price', e.target.value)}
                  placeholder="0.00" className={inp() + ' pl-6'} />
              </div>
            </Field>
            <Field label="Discount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.discount}
                  onChange={e => set('discount', e.target.value)}
                  placeholder="0.00" className={inp() + ' pl-6'} />
              </div>
            </Field>
          </div>

          {discount > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Price after discount: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.max(0, price - discount))}
            </p>
          )}

          <Field label="Deposit Amount">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={form.deposit_amount}
                onChange={e => set('deposit_amount', e.target.value)}
                placeholder="0.00" className={inp() + ' pl-6'} />
            </div>
          </Field>

          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.deposit_received}
                onChange={e => set('deposit_received', e.target.checked)}
                className="w-4 h-4 rounded text-sky-600" />
              <span className="text-sm dark:text-gray-300">Deposit received</span>
            </label>
            <div className="text-right">
              <p className="text-xs text-gray-400">Balance due</p>
              <p className="font-bold text-lg text-amber-600">${balance.toFixed(2)}</p>
            </div>
          </div>
        </Section>

        {/* Assistants */}
        <Section title="Assistants">
          {assistants.map((a, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name">
                  <input value={a.name} onChange={e => updateAssistant(i, 'name', e.target.value)}
                    className={inp()} placeholder="Name" />
                </Field>
                <Field label="Role">
                  <select value={a.role} onChange={e => updateAssistant(i, 'role', e.target.value)} className={inp()}>
                    {ASSISTANT_ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Field label="Pay Amount">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={a.pay_amount}
                        onChange={e => updateAssistant(i, 'pay_amount', e.target.value)}
                        className={inp() + ' pl-6'} placeholder="0.00" />
                    </div>
                  </Field>
                  <Field label="Pay Type">
                    <select value={a.pay_type} onChange={e => updateAssistant(i, 'pay_type', e.target.value)} className={inp()}>
                      <option value="flat">Flat Fee</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </Field>
                </div>
                <button type="button" onClick={() => removeAssistant(i)}
                  className="p-2 text-gray-400 hover:text-red-500 mb-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addAssistant}
            className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium">
            <Plus className="w-4 h-4" /> Add assistant
          </button>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            placeholder="Any notes about this shoot..."
            className={inp() + ' resize-none'} />
        </Section>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-semibold text-base transition-colors">
          {saving ? 'Creating...' : 'Create Booking'}
        </button>
      </form>

      {/* Conflict modal */}
      <Modal open={conflictModal} onClose={() => { setConflictModal(false); setSaving(false); }} title="Scheduling Conflict">
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {conflicts.length} other shoot{conflicts.length !== 1 ? 's' : ''} within the buffer window:
            </p>
          </div>
          {conflicts.map(c => (
            <div key={c.id} className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-sm">
              <p className="font-medium dark:text-white">{c.client_name}</p>
              <p className="text-gray-500">{c.shoot_date} at {c.shoot_time} — {c.shoot_type}</p>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => { setConflictModal(false); setSaving(false); }}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">
              Go Back
            </button>
            <button onClick={() => { setConflictModal(false); doSubmit(true); }}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium">
              Book Anyway
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function inp() {
  return 'w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent';
}
