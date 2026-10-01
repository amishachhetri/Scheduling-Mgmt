import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Package, Mail, TrendingUp, Plus, Download, Calendar, Copy, Check, ExternalLink, Unlink, RefreshCw, Upload } from 'lucide-react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import { SHOOT_TYPES } from '../utils/helpers.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile');

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Google Calendar connected!');
    }
  }, []);

  const TABS = [
    { key: 'profile', label: 'Profile', icon: <User className="w-3.5 h-3.5" /> },
    { key: 'packages', label: 'Packages', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'messages', label: 'Messages', icon: <Mail className="w-3.5 h-3.5" /> },
    { key: 'finances', label: 'Finances', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: 'calendar', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold dark:text-white">Settings</h1>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 py-2 px-3 whitespace-nowrap text-sm font-medium rounded-lg transition-colors ${tab === key ? 'bg-white dark:bg-gray-700 shadow-sm dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'packages' && <PackagesTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'finances' && <FinancesTab />}
      {tab === 'calendar' && <CalendarTab />}
    </div>
  );
}

function ProfileTab() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', business_name: '', smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', smtp_from: '', buffer_hours: 2,
    twilio_account_sid: '', twilio_auth_token: '', twilio_from_number: '',
    bio: '', avatar_url: '', cover_photo_url: '', instagram_url: '', default_extra_photo_price: 15
  });
  const [mediaConfigured, setMediaConfigured] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/profile').then(r => {
      const clean = Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v === null ? '' : v]));
      setForm(f => ({ ...f, ...clean }));
    }).catch(() => {});
    api.get('/media/config').then(r => setMediaConfigured(r.data.configured)).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await api.put('/profile', form);
      toast.success('Profile saved');
    } catch {
      toast.error('Failed to save profile');
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Photographer Info">
        <Field label="Your Name"><input value={form.name} onChange={e => set('name', e.target.value)} className={inp()} /></Field>
        <Field label="Business Name"><input value={form.business_name} onChange={e => set('business_name', e.target.value)} className={inp()} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp()} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={e => set('phone', e.target.value)} className={inp()} /></Field>
        </div>
        <Field label="Travel time buffer (hours)">
          <input type="number" min="0" max="24" value={form.buffer_hours} onChange={e => set('buffer_hours', parseInt(e.target.value))} className={inp()} />
          <p className="text-xs text-gray-400 mt-1">Kept free before and after every shoot on the client booking calendar, and flagged as a conflict on manual bookings.</p>
        </Field>
        <Field label="Default price per extra photo ($)">
          <input type="number" min="0" step="0.01" value={form.default_extra_photo_price} onChange={e => set('default_extra_photo_price', parseFloat(e.target.value))} className={inp()} />
          <p className="text-xs text-gray-400 mt-1">Fallback used only for packages that don't set their own price (Settings → Packages). Full-day packages never charge for extras, regardless of this.</p>
        </Field>
      </Card>

      <Card title="Website Content">
        <p className="text-xs text-gray-500 mb-3">Controls what shows up on the public site's Home and About pages.</p>
        <Field label="About page bio">
          <textarea rows={5} value={form.bio} onChange={e => set('bio', e.target.value)}
            placeholder="I've spent years photographing weddings, growing families, and the small milestones in between..."
            className={inp()} />
          <p className="text-xs text-gray-400 mt-1">Separate paragraphs with a blank line. Leave empty to use the default placeholder copy.</p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <ImageField label="About page portrait" value={form.avatar_url} onChange={v => set('avatar_url', v)} configured={mediaConfigured} />
          <ImageField label="Home page cover photo" value={form.cover_photo_url} onChange={v => set('cover_photo_url', v)} configured={mediaConfigured} />
        </div>
        <Field label="Instagram URL">
          <input value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} placeholder="https://instagram.com/yourstudio" className={inp()} />
        </Field>
      </Card>

      <Card title="Email / SMTP Settings">
        <p className="text-xs text-gray-500 mb-3">Configure SMTP to send automated emails to clients.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMTP Host"><input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" className={inp()} /></Field>
          <Field label="Port"><input type="number" value={form.smtp_port} onChange={e => set('smtp_port', parseInt(e.target.value))} className={inp()} /></Field>
        </div>
        <Field label="Username"><input value={form.smtp_user} onChange={e => set('smtp_user', e.target.value)} placeholder="you@gmail.com" className={inp()} /></Field>
        <Field label="Password"><input type="password" value={form.smtp_pass} onChange={e => set('smtp_pass', e.target.value)} placeholder="App password" className={inp()} /></Field>
        <Field label="From Address"><input value={form.smtp_from} onChange={e => set('smtp_from', e.target.value)} placeholder="Studio Name <you@gmail.com>" className={inp()} /></Field>
      </Card>

      <Card title="Text Message (SMS) Settings">
        <p className="text-xs text-gray-500 mb-3">
          Optional — clients get a text with a link to their booking when you approve a request. Requires a{' '}
          <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">Twilio</a> account.
          Without this, the text is skipped (the client still gets a confirmation email).
        </p>
        <Field label="Twilio Account SID"><input value={form.twilio_account_sid} onChange={e => set('twilio_account_sid', e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className={inp()} /></Field>
        <Field label="Twilio Auth Token"><input type="password" value={form.twilio_auth_token} onChange={e => set('twilio_auth_token', e.target.value)} placeholder="Auth token" className={inp()} /></Field>
        <Field label="Twilio Phone Number"><input value={form.twilio_from_number} onChange={e => set('twilio_from_number', e.target.value)} placeholder="+15551234567" className={inp()} /></Field>
      </Card>

      <button onClick={save} className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold transition-colors">Save Changes</button>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!current || !next || !confirm) return toast.error('Fill in all three fields');
    if (next.length < 8) return toast.error('New password must be at least 8 characters');
    if (next !== confirm) return toast.error('New passwords don\'t match');
    setSaving(true);
    try {
      await api.post('/profile/change-password', { current_password: current, new_password: next });
      toast.success('Password changed — redirecting to login…');
      setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
      setSaving(false);
    }
  };

  return (
    <Card title="Change Password">
      <Field label="Current password"><input type="password" value={current} onChange={e => setCurrent(e.target.value)} className={inp()} /></Field>
      <Field label="New password"><input type="password" value={next} onChange={e => setNext(e.target.value)} className={inp()} /></Field>
      <Field label="Confirm new password"><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inp()} /></Field>
      <button onClick={submit} disabled={saving}
        className="w-full py-3 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
        {saving ? 'Changing…' : 'Change Password'}
      </button>
      <p className="text-xs text-gray-400 mt-2">You'll be logged out everywhere and need to sign back in with the new password.</p>
    </Card>
  );
}

function PackagesTab() {
  const [packages, setPackages] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', shoot_type: '', is_full_day: false, duration_minutes: 120, included_photo_count: 0, extra_photo_price: '' });
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/packages').then(r => setPackages(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.price) return toast.error('Name and price required');
    // Force-clear the extra-photo price for full-day packages even if the field held a stale
    // value from before "Blocks the entire day" was checked -- the UI hides it, but the payload
    // must actually reflect "no charge" regardless of what was previously typed.
    const payload = form.is_full_day ? { ...form, extra_photo_price: '' } : form;
    try {
      if (editing) {
        await api.put(`/packages/${editing}`, payload);
        toast.success('Package updated');
      } else {
        await api.post('/packages', payload);
        toast.success('Package created');
      }
      setModal(false);
      setEditing(null);
      setForm({ name: '', description: '', price: '', shoot_type: '', is_full_day: false, duration_minutes: 120, included_photo_count: 0, extra_photo_price: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save package');
    }
  };

  const archive = async (id, archived) => {
    try {
      await api.put(`/packages/${id}`, { ...packages.find(p => p.id === id), archived: !archived });
      toast.success(archived ? 'Package restored' : 'Package archived');
      load();
    } catch {
      toast.error('Failed to update package');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Permanently delete this package? This cannot be undone.')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Package deleted');
      load();
    } catch {
      toast.error('Failed to delete package');
    }
  };

  const openEdit = (pkg) => {
    setForm({
      name: pkg.name, description: pkg.description, price: pkg.price, shoot_type: pkg.shoot_type,
      is_full_day: !!pkg.is_full_day, duration_minutes: pkg.duration_minutes || 120,
      included_photo_count: pkg.included_photo_count || 0,
      extra_photo_price: pkg.extra_photo_price ?? ''
    });
    setEditing(pkg.id);
    setModal(true);
  };

  const formatDuration = (mins) => {
    if (!mins) return '';
    const h = mins / 60;
    return `${h % 1 === 0 ? h : h.toFixed(1)}hr`;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm({ name: '', description: '', price: '', shoot_type: '', is_full_day: false, duration_minutes: 120, included_photo_count: 0, extra_photo_price: '' }); setEditing(null); setModal(true); }}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> New Package
        </button>
      </div>

      {packages.map(p => (
        <div key={p.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${p.archived ? 'border-gray-200 opacity-50' : 'border-gray-100'} dark:border-gray-700`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold dark:text-white">{p.name} {!!p.archived && <span className="text-xs text-gray-400">(archived)</span>}</p>
              {p.description && <p className="text-sm text-gray-500">{p.description}</p>}
              <div className="flex items-center gap-1.5 mt-0.5">
                {p.shoot_type && <p className="text-xs text-gray-400">{p.shoot_type}</p>}
                {!!p.is_full_day
                  ? <span className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 px-1.5 py-0.5 rounded-full">Blocks full day</span>
                  : <span className="text-xs text-gray-400">· {formatDuration(p.duration_minutes)}</span>}
                {p.included_photo_count > 0 && <span className="text-xs text-gray-400">· {p.included_photo_count} photos included</span>}
                {!p.is_full_day && p.extra_photo_price != null && <span className="text-xs text-gray-400">· ${p.extra_photo_price}/extra</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-sky-600">${p.price}</p>
              <div className="flex gap-2 mt-1">
                <button onClick={() => openEdit(p)} className="text-xs text-sky-600 hover:underline">Edit</button>
                <button onClick={() => archive(p.id, p.archived)} className="text-xs text-gray-500 hover:underline">
                  {p.archived ? 'Restore' : 'Archive'}
                </button>
                {!!p.archived && (
                  <button onClick={() => del(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Package' : 'New Package'}>
        <div className="space-y-3">
          <Field label="Package Name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp()} placeholder="Wedding Full Day" /></Field>
          <Field label="Description"><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp()} placeholder="8 hours, 2 locations, gallery..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inp() + ' pl-7'} placeholder="0.00" />
              </div>
            </Field>
            <Field label="Shoot Type">
              <select value={form.shoot_type} onChange={e => setForm(f => ({ ...f, shoot_type: e.target.value }))} className={inp()}>
                <option value="">Any</option>
                {SHOOT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input type="checkbox" checked={form.is_full_day} onChange={e => setForm(f => ({ ...f, is_full_day: e.target.checked }))}
              className="rounded border-gray-300" />
            Blocks the entire day (weddings, etc.) — otherwise clients book a specific time slot
          </label>
          {!form.is_full_day && (
            <Field label="Session Length">
              <div className="flex items-center gap-2">
                <input type="number" min="0.5" step="0.5" value={(form.duration_minutes || 120) / 60}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: Math.round((parseFloat(e.target.value) || 0.5) * 60) }))}
                  className={inp()} />
                <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">hours</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Plus your travel buffer (Settings → Profile) before and after this session.</p>
            </Field>
          )}
          <Field label="Photos included (proofing galleries)">
            <input type="number" min="0" value={form.included_photo_count}
              onChange={e => setForm(f => ({ ...f, included_photo_count: parseInt(e.target.value) || 0 }))}
              className={inp()} placeholder="0" />
            <p className="text-xs text-gray-400 mt-1">How many photo picks are included in this package before extra ones cost anything.</p>
          </Field>
          {!form.is_full_day && (
            <Field label="Price per extra photo ($)">
              <input type="number" min="0" step="0.01" value={form.extra_photo_price}
                onChange={e => setForm(f => ({ ...f, extra_photo_price: e.target.value }))}
                className={inp()} placeholder="No charge" />
              <p className="text-xs text-gray-400 mt-1">Leave blank for no extra-photo charge on this package. Otherwise defaults to your studio-wide rate (Settings → Profile) until set here.</p>
            </Field>
          )}
          {form.is_full_day && (
            <p className="text-xs text-gray-400 -mt-1">Full-day packages never charge for extra photo picks.</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setModal(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={save} className="flex-1 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MessagesTab() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/messages/templates').then(r => setTemplates(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.put(`/messages/templates/${editing.id}`, editing);
      toast.success('Template saved');
      setEditing(null);
      load();
    } catch {
      toast.error('Failed to save template');
    }
  };

  const TEMPLATE_LABELS = {
    booking_confirmation: 'Booking Confirmation',
    payment_reminder: 'Payment Reminder',
    day_before_reminder: 'Day-Before Reminder',
    gallery_ready: 'Gallery Ready',
    review_request: 'Review Request',
    booking_request_received: 'Request Received (client)',
    booking_request_denied: 'Request Declined (client)',
    new_request_notification: 'New Request Alert (you)',
    booking_confirmed_sms: 'Booking Confirmed — Text Message'
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Merge fields: {'{client_name}'}, {'{shoot_date}'}, {'{shoot_time}'}, {'{location}'}, {'{balance_due}'}, {'{gallery_link}'}, {'{photographer_name}'},{' '}
        {'{reference_code}'}, {'{denial_reason}'}, {'{status_link}'} <span className="text-gray-400">(availability varies by template)</span>
      </p>

      {templates.map(t => (
        <div key={t.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold dark:text-white">{TEMPLATE_LABELS[t.type] || t.type}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.timing_days > 0 ? `${t.timing_days} ${t.timing_days === 1 ? 'day' : 'days'} ${t.timing_direction}` : 'Immediate'}
                {t.enabled ? ' · Active' : ' · Disabled'}
              </p>
            </div>
            <button onClick={() => setEditing({ ...t })} className="text-sm text-sky-600 hover:underline">Edit</button>
          </div>
          <p className="text-xs text-gray-400 mt-2 truncate">{t.subject}</p>
        </div>
      ))}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit: ${TEMPLATE_LABELS[editing?.type] || ''}`} size="lg">
        {editing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium dark:text-gray-300">Active</label>
              <button onClick={() => setEditing(e => ({ ...e, enabled: !e.enabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${editing.enabled ? 'bg-sky-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editing.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            {editing.timing_days > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Days">
                  <input type="number" min="0" value={editing.timing_days} onChange={e => setEditing(d => ({ ...d, timing_days: parseInt(e.target.value) }))} className={inp()} />
                </Field>
                <Field label="Direction">
                  <select value={editing.timing_direction} onChange={e => setEditing(d => ({ ...d, timing_direction: e.target.value }))} className={inp()}>
                    <option value="before">Before shoot</option>
                    <option value="after">After shoot</option>
                  </select>
                </Field>
              </div>
            )}
            <Field label="Subject">
              <input value={editing.subject} onChange={e => setEditing(d => ({ ...d, subject: e.target.value }))} className={inp()} />
            </Field>
            <Field label="Body">
              <textarea value={editing.body} onChange={e => setEditing(d => ({ ...d, body: e.target.value }))}
                rows={8} className={inp() + ' resize-none font-mono text-xs'} />
            </Field>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
              <button onClick={save} className="flex-1 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium">Save Template</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Years back to offer in the Finances/export year pickers -- computed from the current year so
// this never needs a manual code change as time passes (previously a hardcoded array that would
// have quietly stopped covering the current year after 2027).
const YEARS_BACK = 5;
function recentYears() {
  const current = new Date().getFullYear();
  return Array.from({ length: YEARS_BACK }, (_, i) => current - i);
}

function FinancesTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get(`/expenses/summary?year=${year}`).then(r => setSummary(r.data)).catch(() => {});
  }, [year]);

  const downloadBookingsCSV = () => {
    window.open('/api/dashboard/export/bookings', '_blank');
  };

  const downloadClientsCSV = () => {
    window.open('/api/dashboard/export/clients', '_blank');
  };

  const downloadExpensesCSV = () => {
    window.open(`/api/expenses/export?year=${year}`, '_blank');
  };

  const downloadPDF = () => {
    window.open(`/api/expenses/summary/pdf?year=${year}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Card title="Annual Summary">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm dark:text-gray-300">Year:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className={inp()}>
              {recentYears().map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={downloadPDF}
            className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium">
            <Download className="w-3.5 h-3.5" /> Export as PDF
          </button>
        </div>
        {summary && (
          <div className="space-y-2 text-sm">
            <SummaryRow label="Gross Income" value={summary.income} color="text-green-600" />
            <SummaryRow label="Business Expenses" value={summary.expenses} color="text-red-500" />
            <SummaryRow label="Second Shooter Payments" value={summary.second_shooter_payments} color="text-red-500" />
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
              <SummaryRow label="Net Profit" value={summary.net_profit} color="text-sky-600 font-bold" large />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mt-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Estimated Quarterly Tax (25%)</p>
              <p className="text-lg font-bold text-amber-600">${summary.estimated_quarterly_tax.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Q1: ~${(summary.estimated_quarterly_tax / 4).toFixed(0)} · Q2: ~${(summary.estimated_quarterly_tax / 4).toFixed(0)} · etc.</p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Export Data">
        <div className="space-y-2">
          <button onClick={downloadPDF}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="w-4 h-4" /> Download {year} Annual Summary (PDF)
          </button>
          <button onClick={downloadBookingsCSV}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="w-4 h-4" /> Download Bookings CSV
          </button>
          <button onClick={downloadClientsCSV}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="w-4 h-4" /> Download Clients CSV
          </button>
          <button onClick={downloadExpensesCSV}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="w-4 h-4" /> Download {year} Expenses CSV
          </button>
        </div>
      </Card>
    </div>
  );
}

function CalendarTab() {
  const [status, setStatus] = useState(null);
  const [creds, setCreds] = useState({ client_id: '', client_secret: '', calendar_id: 'primary' });
  const [showCredForm, setShowCredForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [icsToken, setIcsToken] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const httpIcsUrl = icsToken ? `${window.location.origin}/api/ics?token=${icsToken}` : '';
  const icsUrl = httpIcsUrl.replace(/^https?/, 'webcal');

  const loadStatus = () => {
    api.get('/calendar/google/status').then(r => setStatus(r.data)).catch(() => {});
  };

  const loadIcsToken = () => {
    api.get('/profile').then(r => setIcsToken(r.data?.ics_feed_token || null)).catch(() => {});
  };

  useEffect(() => { loadStatus(); loadIcsToken(); }, []);

  const regenerateToken = async () => {
    if (!window.confirm('This breaks any calendar app already subscribed to the current link — you\'ll need to re-add it there with the new one. Continue?')) return;
    setRegenerating(true);
    try {
      const res = await api.post('/profile/regenerate-ics-token');
      setIcsToken(res.data.ics_feed_token);
      toast.success('New calendar link generated');
    } catch { toast.error('Failed to regenerate link'); }
    setRegenerating(false);
  };

  const saveCreds = async () => {
    try {
      await api.post('/calendar/google/credentials', creds);
      toast.success('Credentials saved — click Connect to authorize');
      setShowCredForm(false);
      loadStatus();
    } catch { toast.error('Failed to save credentials'); }
  };

  const connect = () => {
    window.location.href = '/api/calendar/google/auth';
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await api.post('/calendar/google/sync');
      toast.success('Synced to Google Calendar');
      loadStatus();
    } catch { toast.error('Sync failed — check credentials'); }
    setSyncing(false);
  };

  const disconnect = async () => {
    try {
      await api.delete('/calendar/google/disconnect');
      toast.success('Disconnected from Google Calendar');
      loadStatus();
    } catch { toast.error('Failed to disconnect'); }
  };

  const copyICS = async () => {
    // https (not webcal) -- the form iOS/Outlook's manual "paste a URL" subscribe fields expect.
    await navigator.clipboard.writeText(httpIcsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  return (
    <div className="space-y-4">
      {/* Google Calendar */}
      <Card title="Google Calendar">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Two-way sync with Google Calendar. Bookings appear in your Google Calendar and external events show as overlays in this app.
        </p>

        {status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
              {status.last_synced && (
                <span className="text-xs text-gray-400 ml-auto">
                  Last synced: {new Date(status.last_synced).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={syncNow} disabled={syncing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button onClick={disconnect}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20">
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-500">Not connected</span>
            </div>

            {!showCredForm ? (
              <button onClick={() => setShowCredForm(true)}
                className="w-full py-2.5 bg-[#4285f4] hover:bg-[#3367d6] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> Set up Google Calendar
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-semibold">Setup steps:</p>
                  <p>1. Go to console.cloud.google.com → Create project</p>
                  <p>2. Enable Google Calendar API</p>
                  <p>3. Create OAuth 2.0 credentials (Web Application)</p>
                  <p>4. Add redirect URI: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{`${window.location.origin}/api/calendar/google/callback`}</code></p>
                  <p>5. Paste credentials below</p>
                </div>
                <Field label="OAuth Client ID">
                  <input value={creds.client_id} onChange={e => setCreds(c => ({ ...c, client_id: e.target.value }))}
                    placeholder="123456789.apps.googleusercontent.com" className={inp()} />
                </Field>
                <Field label="OAuth Client Secret">
                  <input type="password" value={creds.client_secret} onChange={e => setCreds(c => ({ ...c, client_secret: e.target.value }))}
                    placeholder="GOCSPX-..." className={inp()} />
                </Field>
                <Field label="Calendar ID (leave 'primary' for default)">
                  <input value={creds.calendar_id} onChange={e => setCreds(c => ({ ...c, calendar_id: e.target.value }))}
                    placeholder="primary" className={inp()} />
                </Field>
                <div className="flex gap-2">
                  <button onClick={() => setShowCredForm(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white">Cancel</button>
                  <button onClick={saveCreds} className="flex-1 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium">Save & Connect</button>
                </div>
                {status?.has_credentials && (
                  <button onClick={connect}
                    className="w-full py-2 bg-[#4285f4] hover:bg-[#3367d6] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Authorize with Google
                  </button>
                )}
              </div>
            )}

            {status?.has_credentials && !showCredForm && (
              <button onClick={connect}
                className="w-full py-2.5 bg-[#4285f4] hover:bg-[#3367d6] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> Authorize with Google
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Apple Calendar / ICS subscription */}
      <Card title="Apple Calendar / Other Apps">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          One-way feed: your shoots show up in Apple Calendar (or Outlook, Google Calendar, any app
          that supports "subscribe by URL"), updating automatically. This link is private — treat it
          like a password, and regenerate it below if it's ever shared by mistake.
        </p>

        {!icsToken ? (
          <p className="text-sm text-gray-400">Loading your calendar link…</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input readOnly value={httpIcsUrl}
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 dark:text-gray-300 font-mono" />
                <button onClick={copyICS}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex gap-2">
                <a href={icsUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" /> Subscribe in Apple Calendar
                </a>
                <a href={httpIcsUrl} download="shoots.ics"
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              </div>
              <button onClick={regenerateToken} disabled={regenerating}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate link (breaks existing subscriptions)
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p className="font-semibold text-gray-600 dark:text-gray-300">On iPhone/iPad:</p>
              <p>Settings app → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link above.</p>
              <p className="font-semibold text-gray-600 dark:text-gray-300 mt-2">On Mac:</p>
              <p>Tap "Subscribe in Apple Calendar" above, or in the Calendar app: File → New Calendar Subscription → paste the link.</p>
            </div>
          </>
        )}
        <p className="text-xs text-gray-400 mt-2">Updates automatically. Doesn't pull events FROM Apple Calendar into this app — this direction only.</p>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, color, large }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-semibold ${color} ${large ? 'text-lg' : ''}`}>${(value || 0).toFixed(2)}</span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
      <h3 className="font-semibold dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function inp() {
  return 'w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500';
}

function ImageField({ label, value, onChange, configured }) {
  const [uploading, setUploading] = useState(false);
  const fileInput = React.useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(file);
      onChange(uploaded.url);
      toast.success('Uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {value && <img src={value} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0" />}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="https://…" className={inp()} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={!configured || uploading}
          title={configured ? 'Upload a photo' : 'Set up Cloudinary in the Portfolio tab first'}
          className="shrink-0 flex items-center gap-1 border border-gray-300 dark:border-gray-600 disabled:opacity-40 rounded-xl px-3 py-2 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
          <Upload className="w-3.5 h-3.5" /> {uploading ? '…' : 'Upload'}
        </button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      </div>
    </Field>
  );
}
