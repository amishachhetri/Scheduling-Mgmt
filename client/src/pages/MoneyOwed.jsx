import React, { useEffect, useState } from 'react';
import { Plus, Check, ChevronUp, ChevronDown, Wallet, Pencil, Trash2 } from 'lucide-react';
import api from '../utils/api.js';
import { formatCurrency, formatDate, daysAgo } from '../utils/helpers.js';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext.jsx';

export default function MoneyOwed() {
  const [entries, setEntries] = useState([]);
  const [paid, setPaid] = useState([]);
  const [showPaid, setShowPaid] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', due_date: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [paidYear, setPaidYear] = useState('');
  const [paidMonth, setPaidMonth] = useState('');
  const { refresh } = useApp();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/money-owed?paid=false'),
      api.get('/money-owed?paid=true')
    ]).then(([u, p]) => {
      setEntries(u.data);
      setPaid(p.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const closeAddModal = () => { setAddModal(false); setEditingId(null); setForm({ name: '', amount: '', due_date: '', notes: '' }); };

  const openEdit = (e) => {
    setForm({ name: e.name, amount: e.amount, due_date: e.due_date || '', notes: e.notes || '' });
    setEditingId(e.id);
    setAddModal(true);
  };

  const saveEntry = async () => {
    if (!form.name || !form.amount) return toast.error('Name and amount required');
    try {
      if (editingId) {
        await api.put(`/money-owed/${editingId}`, form);
        toast.success('Entry updated');
      } else {
        await api.post('/money-owed', form);
        toast.success('Entry added');
      }
      closeAddModal();
      load();
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save entry');
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await api.delete(`/money-owed/${id}`);
      toast.success('Entry deleted');
      load();
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete entry');
    }
  };

  const markPaid = async () => {
    try {
      await api.put(`/money-owed/${payModal.id}/pay`);
      toast.success('Marked as paid');
      setPayModal(null);
      load();
      refresh();
    } catch {
      toast.error('Failed to mark as paid');
    }
  };

  const totalOwed = entries.reduce((s, e) => s + e.amount, 0);

  // Build year options from paid entries
  const paidYears = [...new Set(paid.map(e => e.paid_at?.slice(0, 4)).filter(Boolean))].sort((a,b) => b-a);
  const months = [
    { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' }, { value: '04', label: 'Apr' },
    { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' }, { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
  ];

  const filteredPaid = paid.filter(e => {
    const dateStr = e.paid_at?.slice(0, 10) || '';
    if (paidYear && !dateStr.startsWith(paidYear)) return false;
    if (paidMonth && dateStr.slice(5, 7) !== paidMonth) return false;
    return true;
  });

  const filteredPaidTotal = filteredPaid.reduce((s, e) => s + e.amount, 0);
  const isPaidFiltered = paidYear || paidMonth;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Money Owed</h1>
          <p className="text-sm text-gray-500">Total outstanding: <span className="font-semibold text-amber-600">{formatCurrency(totalOwed)}</span></p>
        </div>
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl font-medium text-sm">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-gray-400">No outstanding balances</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => {
            const overdueDays = e.due_date ? daysAgo(e.due_date) : null;
            const overdue = overdueDays !== null && overdueDays > 0;
            return (
              <div key={e.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border ${overdue ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-700'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold dark:text-white">{e.name}</p>
                      {e.type === 'booking' && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">Booking</span>}
                      {overdue && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{overdueDays}d overdue</span>}
                    </div>
                    {e.due_date && <p className="text-xs text-gray-500 mt-0.5">Due: {formatDate(e.due_date)}</p>}
                    {e.shoot_date && <p className="text-xs text-gray-400">Shoot: {formatDate(e.shoot_date)} — {e.shoot_type}</p>}
                    {e.notes && <p className="text-xs text-gray-400 mt-1">{e.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-amber-600">{formatCurrency(e.amount)}</p>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      {e.type === 'manual' && (
                        <>
                          <button onClick={() => openEdit(e)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => deleteEntry(e.id)} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                      <button onClick={() => setPayModal(e)}
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                        <Check className="w-3 h-3" /> Mark Paid
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed payments section */}
      <div>
        <button onClick={() => setShowPaid(!showPaid)}
          className="flex items-center gap-1 text-sm text-sky-600 hover:underline">
          {showPaid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showPaid ? 'Hide' : 'Show'} Completed Payments ({paid.length})
        </button>

        {showPaid && (
          <div className="mt-3 space-y-3">
            {/* Filters */}
            {paidYears.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">Filter by:</span>
                <select value={paidYear} onChange={e => { setPaidYear(e.target.value); setPaidMonth(''); }}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
                  <option value="">All years</option>
                  {paidYears.map(y => <option key={y}>{y}</option>)}
                </select>
                <select value={paidMonth} onChange={e => setPaidMonth(e.target.value)}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none">
                  <option value="">All months</option>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {isPaidFiltered && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Total for period: <span className="font-semibold text-green-600">{formatCurrency(filteredPaidTotal)}</span>
                  </span>
                )}
              </div>
            )}

            {filteredPaid.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No completed payments for this period</p>
            ) : (
              <div className="space-y-2 opacity-70">
                {filteredPaid.map(e => (
                  <div key={e.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-green-100 dark:border-green-900/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium dark:text-white flex items-center gap-1.5 text-sm">
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          {e.name}
                        </p>
                        {e.paid_at && <p className="text-xs text-gray-400">Paid {new Date(e.paid_at).toLocaleDateString()}</p>}
                        {e.shoot_date && <p className="text-xs text-gray-400">{formatDate(e.shoot_date)}</p>}
                      </div>
                      <p className="font-semibold text-green-600">{formatCurrency(e.amount)}</p>
                    </div>
                  </div>
                ))}

                {/* Running total at bottom */}
                {filteredPaid.length > 1 && (
                  <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {isPaidFiltered ? 'Period total' : 'Total received'}
                    </span>
                    <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(filteredPaidTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={addModal} onClose={closeAddModal} title={editingId ? 'Edit Money Owed' : 'Add Money Owed'}>
        <div className="space-y-3">
          <div><label className="text-sm font-medium dark:text-gray-300">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Who owes you?"
              className={inp()} /></div>
          <div><label className="text-sm font-medium dark:text-gray-300">Amount</label>
            <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
              className={inp()} /></div>
          <div><label className="text-sm font-medium dark:text-gray-300">Due Date (optional)</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className={inp()} /></div>
          <div><label className="text-sm font-medium dark:text-gray-300">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Details..."
              className={inp()} /></div>
          <div className="flex gap-3">
            <button onClick={closeAddModal} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={saveEntry} className="flex-1 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium">{editingId ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Mark as Paid?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will archive the <span className="font-semibold">{formatCurrency(payModal?.amount)}</span> balance from <span className="font-semibold">{payModal?.name}</span>.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPayModal(null)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={markPaid}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Mark Paid
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function inp() {
  return 'mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500';
}
