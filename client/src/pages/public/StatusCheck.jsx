import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, CheckCircle2, Clock, XCircle, ImageIcon } from 'lucide-react';
import api from '../../utils/api.js';
import { formatDate, formatTimeRange, formatCurrency } from '../../utils/helpers.js';

const STATUS_META = {
  Requested: { label: 'Pending review', icon: Clock, color: 'text-pending', bg: 'bg-pending-soft' },
  Upcoming: { label: 'Confirmed', icon: CheckCircle2, color: 'text-confirmed', bg: 'bg-confirmed-soft' },
  Completed: { label: 'Completed', icon: CheckCircle2, color: 'text-confirmed', bg: 'bg-confirmed-soft' },
  Denied: { label: 'Declined', icon: XCircle, color: 'text-declined', bg: 'bg-declined-soft' },
  Cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-declined', bg: 'bg-declined-soft' }
};

export default function StatusCheck() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!email || !code) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get('/public/booking-status', { params: { email, code } });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Deep-link support: if both params arrive via URL (e.g. an SMS/email link), look up automatically.
  useEffect(() => {
    if (searchParams.get('email') && searchParams.get('code')) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = result ? STATUS_META[result.status] || STATUS_META.Requested : null;
  const StatusIcon = meta?.icon;

  return (
    <div className="px-6 md:px-10 py-12 max-w-lg mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-accent">Check your request</div>
      <h1 className="font-display text-3xl mt-2">Booking status</h1>
      <p className="text-ink-soft mt-3 leading-relaxed">
        Enter the email you booked with and your reference code — it was included in your confirmation email.
      </p>

      <form onSubmit={lookup} className="mt-6 space-y-4">
        <div>
          <label htmlFor="sc-email" className="text-xs uppercase tracking-wider text-ink-faint">Email</label>
          <input id="sc-email" required type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="priya@email.com"
            className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label htmlFor="sc-code" className="text-xs uppercase tracking-wider text-ink-faint">Reference code</label>
          <input id="sc-code" required value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="F-284KX"
            className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised font-mono focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent disabled:opacity-60 text-white text-sm font-semibold px-6 py-3 rounded">
          <Search className="w-4 h-4" /> {loading ? 'Looking up…' : 'Check status'}
        </button>
      </form>

      {error && <p className="text-sm text-declined mt-4">{error}</p>}

      {result && meta && (
        <div className="mt-8 border border-line rounded-md bg-paper-raised p-5">
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
            <StatusIcon className="w-3.5 h-3.5" /> {meta.label}
          </div>

          <div className="mt-4">
            <div className="font-display text-xl">{result.shoot_type}{result.shoot_type_detail ? ` — ${result.shoot_type_detail}` : ''}</div>
            <p className="text-sm text-ink-soft mt-1">
              {formatDate(result.shoot_date)}, {formatTimeRange(result.shoot_time, result.shoot_end_time)}
              {result.location ? ` · ${result.location}` : ''}
            </p>
            {result.package_name && <p className="text-sm text-ink-faint mt-1">{result.package_name}</p>}
          </div>

          {result.events?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-xs uppercase tracking-wider text-ink-faint mb-1.5">Additional days</p>
              <ul className="text-sm space-y-0.5">
                {result.events.map((ev, i) => (
                  <li key={i}>{formatDate(ev.event_date)} — {ev.event_name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.status === 'Requested' && (
            <p className="text-sm text-ink-soft mt-4 pt-4 border-t border-line leading-relaxed">
              Your request is still being reviewed. You'll get an email as soon as it's confirmed — usually within a couple of days.
            </p>
          )}

          {result.status === 'Denied' && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-sm text-ink-soft leading-relaxed">
                This request wasn't able to be confirmed.{result.denial_reason ? ` ${result.denial_reason}` : ''}
              </p>
              <Link to="/book" className="text-sm text-accent font-semibold hover:underline mt-2 inline-block">Submit a new request →</Link>
            </div>
          )}

          {(result.status === 'Upcoming' || result.status === 'Completed') && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-xs uppercase tracking-wider text-ink-faint mb-2">Before your shoot</p>
              <div className="space-y-1.5">
                {result.deposit_amount > 0 && (
                  <TaskRow done={result.deposit_received} label={`Deposit — ${formatCurrency(result.deposit_amount)}`} />
                )}
                <TaskRow done={result.contract_signed} label="Sign contract" />
              </div>
              {result.balance_due > 0 && (
                <p className="text-sm text-ink-soft mt-3">Remaining balance: <span className="font-semibold text-ink">{formatCurrency(result.balance_due)}</span></p>
              )}
              {!result.contract_signed || (result.deposit_amount > 0 && !result.deposit_received) ? (
                <p className="text-xs text-ink-faint mt-2">We'll follow up directly to take care of anything still open above.</p>
              ) : null}
            </div>
          )}

          {result.status === 'Completed' && result.gallery_link && (
            <a href={result.gallery_link} target="_blank" rel="noreferrer"
              className="mt-4 flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded justify-center">
              <ImageIcon className="w-4 h-4" /> View your gallery
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ done, label }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-confirmed-soft text-confirmed' : 'border border-line-strong'}`}>
        {done && <CheckCircle2 className="w-3 h-3" />}
      </span>
      <span className={done ? 'text-ink-soft line-through' : 'text-ink'}>{label}</span>
    </div>
  );
}
