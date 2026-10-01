import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api.js';
import { formatDate, formatTime } from '../utils/helpers.js';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';

// Shared by the Bookings list (reschedule from a card) and the Booking detail page -- previously
// each had its own near-identical copy of this modal, which is exactly the kind of duplication
// that let them drift out of sync with each other.
export default function RescheduleModal({ booking, open, onClose, onRescheduled }) {
  const [date, setDate] = useState(booking?.shoot_date || '');
  const [time, setTime] = useState(booking?.shoot_time || '');
  const [endTime, setEndTime] = useState(booking?.shoot_end_time || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { refresh } = useApp();

  useEffect(() => {
    if (open && booking) {
      setDate(booking.shoot_date || '');
      setTime(booking.shoot_time || '');
      setEndTime(booking.shoot_end_time || '');
      setNote('');
    }
  }, [open, booking]);

  const submit = async () => {
    if (!date) { toast.error('Date is required'); return; }
    setSaving(true);
    try {
      const res = await api.put(`/bookings/${booking.id}/reschedule`, {
        shoot_date: date, shoot_time: time, shoot_end_time: endTime, note
      });
      if (res.data.conflicts?.length > 0) {
        toast(`Rescheduled, but this now overlaps ${res.data.conflicts.length} other shoot${res.data.conflicts.length !== 1 ? 's' : ''} — double-check the calendar.`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success('Booking rescheduled');
      }
      refresh();
      onRescheduled?.();
      onClose();
    } catch { toast.error('Failed to reschedule'); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Booking">
      {booking && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current: {formatDate(booking.shoot_date)} {booking.shoot_time && `at ${formatTime(booking.shoot_time)}`}
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium dark:text-gray-300">New Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium dark:text-gray-300">Start Time</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="text-sm font-medium dark:text-gray-300">End Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium dark:text-gray-300">Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Reason for rescheduling..."
                className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white resize-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white">
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">
              {saving ? 'Saving...' : 'Reschedule'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
