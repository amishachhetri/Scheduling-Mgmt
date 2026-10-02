import React, { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import api from '../utils/api.js';
import { formatDate } from '../utils/helpers.js';
import toast from 'react-hot-toast';

const PURGE_WINDOW_MS = 24 * 60 * 60 * 1000;

// How long until a trashed row is permanently purged. Purging itself only runs as part of the
// once-a-day cron job, not the instant this window closes, so the true worst case is a bit
// under 48h -- "purges in ~Xh" undersells that, but a hard countdown to a time we can't actually
// guarantee would be worse.
function timeLeft(deletedAt) {
  const deletedMs = new Date(deletedAt.replace(' ', 'T') + 'Z').getTime();
  const remainingMs = deletedMs + PURGE_WINDOW_MS - Date.now();
  if (remainingMs <= 0) return 'Purging soon';
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `~${hours}h ${mins}m left` : `~${mins}m left`;
}

export default function Trash() {
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/bookings/trash'), api.get('/clients/trash')])
      .then(([b, c]) => { setBookings(b.data); setClients(c.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const restoreBooking = async (id) => {
    try {
      await api.post(`/bookings/${id}/restore`);
      toast.success('Booking restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore');
    }
  };

  const restoreClient = async (id) => {
    try {
      await api.post(`/clients/${id}/restore`);
      toast.success('Client restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Trash</h1>
        <p className="text-sm text-gray-500">Deleted bookings and clients stay here for about 24 hours before being permanently removed.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : bookings.length === 0 && clients.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
            <Trash2 className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-400">Trash is empty</p>
        </div>
      ) : (
        <>
          {bookings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Bookings ({bookings.length})</h2>
              <div className="space-y-2">
                {bookings.map(b => (
                  <div key={b.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold dark:text-white">{b.client_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{b.shoot_type} — {formatDate(b.shoot_date)}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{timeLeft(b.deleted_at)}</p>
                    </div>
                    <button onClick={() => restoreBooking(b.id)}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl text-sm font-medium shrink-0">
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clients.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Clients ({clients.length})</h2>
              <div className="space-y-2">
                {clients.map(c => (
                  <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold dark:text-white">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                      <p className="text-xs text-amber-600 mt-0.5">{timeLeft(c.deleted_at)}</p>
                    </div>
                    <button onClick={() => restoreClient(c.id)}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-xl text-sm font-medium shrink-0">
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
