import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api.js';
import { formatDate, formatCurrency } from '../utils/helpers.js';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';

// Shared by the Bookings list (cancel from a card's status popover) and the Booking detail page --
// this is the one true way to cancel a booking (captures a note + what happens to the deposit),
// distinct from a plain status edit.
export default function CancelModal({ booking, open, onClose, onCancelled }) {
  const [note, setNote] = useState('');
  const [depositDecision, setDepositDecision] = useState('keep');
  const { refresh } = useApp();

  useEffect(() => {
    if (open) { setNote(''); setDepositDecision('keep'); }
  }, [open]);

  const confirm = async () => {
    try {
      await api.put(`/bookings/${booking.id}/cancel`, {
        cancellation_note: note,
        deposit_decision: depositDecision,
      });
      toast.success('Booking cancelled');
      refresh();
      onCancelled?.();
      onClose();
    } catch { toast.error('Failed to cancel booking'); }
  };

  if (!booking) return null;

  return (
    <Modal open={open} onClose={onClose} title="Cancel Booking">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Cancel booking for <strong>{booking.client_name}</strong> on {formatDate(booking.shoot_date)}?
        </p>
        <div>
          <label className="text-sm font-medium dark:text-gray-300">Reason (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={3} placeholder="e.g. Client requested cancellation due to..."
            className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white resize-none" />
        </div>
        {booking.deposit_amount > 0 && (
          <div>
            <label className="text-sm font-medium dark:text-gray-300">
              Deposit of {formatCurrency(booking.deposit_amount)}
            </label>
            <div className="mt-2 space-y-1.5">
              {[['keep', 'Keep deposit'], ['refund', 'Refund deposit'], ['pending', 'Decide later']].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="deposit-decision" value={v} checked={depositDecision === v}
                    onChange={() => setDepositDecision(v)} className="accent-sky-600" />
                  <span className="text-sm dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white">
            Back
          </button>
          <button onClick={confirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium">
            Confirm Cancellation
          </button>
        </div>
      </div>
    </Modal>
  );
}
