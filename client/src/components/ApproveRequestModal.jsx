import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '../utils/api.js';
import { ASSISTANT_ROLES, formatCurrency, formatDate, formatTimeRange, defaultDepositForPackage } from '../utils/helpers.js';
import Modal from './Modal.jsx';

// Shared "confirm the details before it's a real booking" step, opened from both the
// Requests page and the Dashboard's quick-approve list -- so approving never skips
// straight past location/cost/deposit/assistant info the photographer would otherwise
// have to go add separately on the booking detail page.
export default function ApproveRequestModal({ request, onClose, onApproved }) {
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [depositReceived, setDepositReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    api.get('/packages').then(r => setPackages(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!request) return;
    setLocation(request.location || '');
    setPrice(request.package_price ?? '');
    setDiscount(request.discount || '');
    // Public requests never come in with a deposit set -- default to the small/big shoot
    // tier so the photographer doesn't have to remember the rule for every approval.
    if (request.deposit_amount) {
      setDeposit(request.deposit_amount);
    } else {
      const pkg = packages.find(p => p.id === request.package_id);
      const isFullDay = pkg ? !!pkg.is_full_day : !!request.shoot_type?.toLowerCase().includes('wedding');
      setDeposit(defaultDepositForPackage({ is_full_day: isFullDay }));
    }
    setDepositReceived(!!request.deposit_received);
    setNotes(request.notes || '');
    setAssistants([]);
  }, [request, packages]);

  const p = parseFloat(price) || 0;
  const d = parseFloat(discount) || 0;
  const dep = parseFloat(deposit) || 0;
  const balance = Math.max(0, p - d - dep);

  const addAssistant = () => setAssistants(a => [...a, { name: '', role: 'Assistant Photographer', pay_amount: '', pay_type: 'flat' }]);
  const updateAssistant = (i, k, v) => setAssistants(a => a.map((s, j) => j === i ? { ...s, [k]: v } : s));
  const removeAssistant = (i) => setAssistants(a => a.filter((_, j) => j !== i));

  const confirmApprove = async () => {
    setSaving(true);
    try {
      await api.put(`/bookings/${request.id}`, {
        location,
        package_price: p,
        discount: d,
        deposit_amount: dep,
        deposit_received: depositReceived,
        notes,
        second_shooters: assistants.filter(a => a.name.trim()),
      });
      await api.post(`/admin/requests/${request.id}/approve`);
      toast.success(`Approved — ${request.client_name} is booked`);
      onApproved(request.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!request} onClose={onClose} title="Review & Approve" size="lg">
      {request && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
            <p className="font-semibold dark:text-white">{request.client_name} — {request.shoot_type}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(request.shoot_date)}, {formatTimeRange(request.shoot_time, request.shoot_end_time)}
            </p>
          </div>

          <Field label="Location">
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue name or address" className={inp()} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Confirm Price">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={inp() + ' pl-6'} />
              </div>
            </Field>
            <Field label="Discount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className={inp() + ' pl-6'} />
              </div>
            </Field>
          </div>

          <Field label="Deposit Amount">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} className={inp() + ' pl-6'} />
            </div>
          </Field>

          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={depositReceived} onChange={e => setDepositReceived(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600" />
              <span className="text-sm dark:text-gray-300">Deposit received</span>
            </label>
            <div className="text-right">
              <p className="text-xs text-gray-400">Balance due</p>
              <p className="font-bold text-lg text-amber-600">{formatCurrency(balance)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assistants</label>
              <button type="button" onClick={addAssistant}
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium">
                <Plus className="w-3 h-3" /> Add assistant
              </button>
            </div>
            {assistants.length === 0 && <p className="text-xs text-gray-400">None assigned yet</p>}
            <div className="space-y-2">
              {assistants.map((a, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name">
                      <input value={a.name} onChange={e => updateAssistant(i, 'name', e.target.value)} className={inp()} placeholder="Name" />
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
                          <input type="number" min="0" step="0.01" value={a.pay_amount} onChange={e => updateAssistant(i, 'pay_amount', e.target.value)}
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
                    <button type="button" onClick={() => removeAssistant(i)} className="p-2 text-gray-400 hover:text-red-500 mb-0.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp() + ' resize-none'} />
          </Field>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white">
              Cancel
            </button>
            <button onClick={confirmApprove} disabled={saving}
              className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium">
              {saving ? 'Approving…' : 'Confirm & Approve'}
            </button>
          </div>
        </div>
      )}
    </Modal>
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
