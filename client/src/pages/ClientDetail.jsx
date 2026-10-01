import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Plus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api.js';
import { formatDate, formatTime, formatCurrency } from '../utils/helpers.js';
import { StageBadge, StatusBadge } from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/clients/${id}`).then(r => {
      setClient(r.data);
      setLoadError(false);
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    setEditForm({ name: client.name, email: client.email || '', phone: client.phone || '' });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      await api.put(`/clients/${id}`, editForm);
      toast.success('Contact info updated');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update client');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>;
  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <p className="text-gray-500 dark:text-gray-400">Couldn't load this client. Check your connection and try again.</p>
      <button onClick={load} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium">Retry</button>
    </div>
  );
  if (!client) return <div className="text-center py-12 text-gray-400">Client not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold dark:text-white">{client.name}</h1>
          <p className="text-sm text-gray-500">{client.total_shoots} shoot{client.total_shoots !== 1 ? 's' : ''} · {formatCurrency(client.total_spent)} total spent</p>
        </div>
        <button
          onClick={() => navigate(`/admin/bookings/new?client_name=${encodeURIComponent(client.name)}&client_email=${encodeURIComponent(client.email || '')}&client_phone=${encodeURIComponent(client.phone || '')}`)}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold dark:text-white">Contact</h2>
          <button onClick={openEdit} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        <div className="space-y-2 text-sm dark:text-gray-300">
          {client.email && (
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <a href={`mailto:${client.email}`} className="text-sky-600 hover:underline">{client.email}</a>
            </p>
          )}
          {client.phone && (
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <a href={`tel:${client.phone}`} className="text-sky-600 hover:underline">{client.phone}</a>
            </p>
          )}
          {!client.email && !client.phone && <p className="text-gray-400">No contact info on file</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold dark:text-white mb-3">Bookings</h2>
        <div className="space-y-2">
          {client.bookings?.length === 0 ? (
            <p className="text-sm text-gray-400">No bookings yet</p>
          ) : client.bookings?.map(b => (
            <button key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)}
              className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div>
                <p className="font-medium text-sm dark:text-white">{b.shoot_type} · {formatDate(b.shoot_date)}</p>
                <p className="text-xs text-gray-500">{formatTime(b.shoot_time)}{b.location ? ` · ${b.location}` : ''}</p>
                <div className="mt-1"><StageBadge stage={b.workflow_stage} /></div>
              </div>
              <div className="text-right">
                <StatusBadge status={b.status} />
                {b.balance_due > 0 && <p className="text-xs text-amber-600 mt-1">{formatCurrency(b.balance_due)} owed</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {client.messages?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold dark:text-white mb-3">Message History</h2>
          <div className="space-y-2">
            {client.messages.map(m => (
              <div key={m.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium dark:text-gray-300">{m.template_type?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-400">{new Date(m.sent_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{m.subject}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Contact Info">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium dark:text-gray-300">Name</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="text-sm font-medium dark:text-gray-300">Email</label>
            <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="text-sm font-medium dark:text-gray-300">Phone</label>
            <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <p className="text-xs text-gray-400">Note: this doesn't change the client name on file for past bookings, only future ones.</p>
          <div className="flex gap-3">
            <button onClick={() => setEditModal(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
