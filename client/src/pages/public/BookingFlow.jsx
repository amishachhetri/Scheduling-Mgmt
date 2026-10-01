import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, isBefore, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';
import api from '../../utils/api.js';
import { FULL_DAY_START, FULL_DAY_END, formatTime } from '../../utils/helpers.js';

const STEPS = ['Session', 'Date', 'Details'];
const OTHER_OPTION = {
  id: 'other',
  name: 'Something else',
  description: "Not seeing what you need? Tell us what you have in mind and we'll follow up with a custom quote.",
  price: null,
  shoot_type: 'Other'
};

export default function BookingFlow() {
  const [searchParams] = useSearchParams();
  const preselectedPackage = searchParams.get('package');

  const [step, setStep] = useState(preselectedPackage ? 2 : 1);
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState(preselectedPackage || '');
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [unavailable, setUnavailable] = useState(new Set());
  const [selectedDates, setSelectedDates] = useState([]); // sorted array of Date
  const [dayLabels, setDayLabels] = useState({}); // 'yyyy-MM-dd' -> label, for multi-day extra dates
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', location: '', notes: '', website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [showInvalidPackageNotice, setShowInvalidPackageNotice] = useState(false);
  const [otherDescription, setOtherDescription] = useState('');

  useEffect(() => {
    api.get('/public/packages').then(r => setPackages(r.data)).finally(() => setPackagesLoaded(true));
  }, []);

  const isOther = packageId === 'other';
  const selectedPackage = useMemo(() => {
    if (packageId === 'other') return OTHER_OPTION;
    return packages.find(p => p.id === packageId);
  }, [packages, packageId]);
  const invalidPackageId = packagesLoaded && packageId && !selectedPackage;
  const isMultiDay = !!selectedPackage?.shoot_type?.toLowerCase().includes('multi-day');
  // Multi-day weddings always block the whole day; other packages can be flagged
  // full-day too (e.g. a single-day wedding) via the package's is_full_day setting.
  const isFullDay = isMultiDay || !!selectedPackage?.is_full_day;

  // Switching packages resets date/time state so stale selections from one package
  // (e.g. single-day vs multi-day) don't carry into another.
  useEffect(() => {
    setSelectedDates([]);
    setDayLabels({});
    setSelectedTime('');
    setOtherDescription('');
  }, [packageId]);

  // For timed (non-full-day) packages, once a date is picked, fetch the actual candidate start
  // times for THIS package's session length (duration + travel buffer already baked in server-side)
  // so we only ever offer times that genuinely fit.
  const [timeSlots, setTimeSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const primarySelectedKey = selectedDates[0] ? format(selectedDates[0], 'yyyy-MM-dd') : null;
  useEffect(() => {
    setSelectedTime('');
    if (isFullDay || !primarySelectedKey || !packageId) { setTimeSlots([]); return; }
    let cancelled = false;
    setSlotsLoading(true);
    const pkgParam = isOther ? '' : `&package_id=${packageId}`;
    api.get(`/public/availability/slots?date=${primarySelectedKey}${pkgParam}`)
      .then(r => { if (!cancelled) { setTimeSlots(r.data.slots); setSlotsLoading(false); } })
      .catch(() => { if (!cancelled) { setTimeSlots([]); setSlotsLoading(false); } });
    return () => { cancelled = true; };
  }, [isFullDay, primarySelectedKey, packageId, isOther]);

  // A ?package= id that doesn't match any real package (stale link, archived package, typo)
  // shouldn't silently sit there letting the user pick a date for something that isn't real.
  useEffect(() => {
    if (invalidPackageId) {
      setShowInvalidPackageNotice(true);
      setPackageId('');
      setStep(1);
    }
  }, [invalidPackageId]);

  const choosePackage = (id) => {
    setPackageId(id);
    setShowInvalidPackageNotice(false);
    setStep(2);
  };

  // Rapid month navigation can fire requests that resolve out of order; only ever apply
  // the response for the most recently requested month. While a fetch is in flight the
  // calendar is disabled rather than treating not-yet-loaded days as available.
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const latestRequestedMonth = useRef(null);
  const fetchAvailability = useCallback((forMonth) => {
    const start = format(startOfMonth(forMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(forMonth), 'yyyy-MM-dd');
    latestRequestedMonth.current = start;
    setAvailabilityLoading(true);
    const pkgParam = packageId && !isOther ? `&package_id=${packageId}` : '';
    api.get(`/public/availability?start=${start}&end=${end}${pkgParam}`)
      .then(r => {
        if (latestRequestedMonth.current === start) {
          setUnavailable(new Set(r.data.unavailable_dates));
          setAvailabilityLoading(false);
        }
      })
      .catch(() => {
        if (latestRequestedMonth.current === start) setAvailabilityLoading(false);
      });
  }, [packageId, isOther]);

  useEffect(() => { fetchAvailability(month); }, [month, fetchAvailability]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const days = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [month]);

  const today = startOfDay(new Date());

  const toggleDate = (d) => {
    if (!isMultiDay) { setSelectedDates([d]); return; }
    setSelectedDates(prev => {
      const exists = prev.some(x => isSameDay(x, d));
      const next = exists ? prev.filter(x => !isSameDay(x, d)) : [...prev, d];
      return next.sort((a, b) => a - b);
    });
  };

  const removeDate = (d) => setSelectedDates(prev => prev.filter(x => !isSameDay(x, d)));

  const canContinueToDetails = selectedDates.length > 0 && (isFullDay || selectedTime);
  const canSubmit = !isOther || otherDescription.trim().length >= 10;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const sorted = [...selectedDates].sort((a, b) => a - b);
      const primaryKey = format(sorted[0], 'yyyy-MM-dd');
      const shootTime = isFullDay ? FULL_DAY_START : selectedTime;
      const shootEndTime = isFullDay ? FULL_DAY_END : null;
      const events = isMultiDay
        ? sorted.slice(1).map(d => {
            const key = format(d, 'yyyy-MM-dd');
            return { event_date: key, event_name: dayLabels[key] || 'Additional day' };
          })
        : [];

      const res = await api.post('/public/booking-requests', {
        client_name: form.client_name,
        client_email: form.client_email,
        client_phone: form.client_phone,
        shoot_type: selectedPackage.shoot_type,
        shoot_type_detail: isOther ? otherDescription.trim() : (isMultiDay ? (dayLabels[primaryKey] || null) : null),
        shoot_date: primaryKey,
        shoot_time: shootTime,
        shoot_end_time: shootEndTime,
        location: form.location,
        package_id: isOther ? null : packageId,
        notes: form.notes,
        events,
        website: form.website
      });
      setResult(res.data.booking);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedSelected = useMemo(() => [...selectedDates].sort((a, b) => a - b), [selectedDates]);
  const timeSummary = isFullDay ? 'Full Day' : formatTime(selectedTime);

  if (step === 4 && result) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <div className="w-12 h-12 rounded-full bg-pending-soft text-pending flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="font-display text-2xl">Request sent</h1>
        <p className="text-sm text-ink-soft mt-3 leading-relaxed">
          {form.client_name.split(' ')[0]}, your {isOther ? 'request' : selectedPackage?.shoot_type + ' request'} for{' '}
          {sortedSelected.length > 1
            ? `${sortedSelected.length} days starting ${format(sortedSelected[0], 'MMM d')}`
            : `${format(sortedSelected[0], 'MMM d')} (${timeSummary})`
          } is with the studio now. You'll get an email as soon as it's confirmed — usually within a couple of days.
        </p>
        <div className="font-mono text-sm bg-paper-sunken border border-line rounded px-3 py-2 mt-5 inline-block">
          Reference {result.reference_code}
        </div>
        <p className="text-xs text-ink-faint mt-3">
          Save this — you can check your request status anytime with it.
        </p>
        <div className="mt-8 flex items-center justify-center gap-5">
          <Link to="/" className="text-sm text-accent font-semibold hover:underline">Back to home</Link>
          <Link to={`/status?code=${result.reference_code}&email=${encodeURIComponent(form.client_email)}`} className="text-sm text-accent font-semibold hover:underline">
            Check status →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-ink-faint mb-6">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span>—</span>}
            <span className={step === i + 1 ? 'text-accent font-bold' : ''}>{i + 1}. {label}</span>
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h1 className="font-display text-2xl mb-1">Choose your session</h1>
          <p className="text-sm text-ink-soft mb-5">Pick a package to see available dates.</p>

          {showInvalidPackageNotice && (
            <p className="text-sm text-declined mb-4 bg-declined-soft border border-line rounded px-3 py-2">
              That session type isn't available anymore — please pick one below.
            </p>
          )}

          {!packagesLoaded ? (
            <p className="text-ink-faint">Loading…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {packages.map(p => (
                <button key={p.id} onClick={() => choosePackage(p.id)}
                  className="text-left border border-line rounded-md p-5 bg-paper-raised hover:border-accent transition-colors flex flex-col gap-2">
                  <div className="font-display text-lg">{p.name}</div>
                  <p className="text-sm text-ink-soft leading-relaxed flex-1">{p.description}</p>
                  <div className="font-mono text-lg pt-1 border-t border-line flex items-baseline justify-between">
                    <span>${p.price.toLocaleString()}</span>
                    <span className="font-sans text-xs text-ink-faint">
                      {p.is_full_day ? 'Full day' : `~${p.duration_minutes % 60 === 0 ? p.duration_minutes / 60 : (p.duration_minutes / 60).toFixed(1)} hr`}
                    </span>
                  </div>
                </button>
              ))}
              <button onClick={() => choosePackage('other')}
                className="text-left border border-dashed border-line-strong rounded-md p-5 bg-paper hover:border-accent transition-colors flex flex-col gap-2">
                <div className="font-display text-lg">{OTHER_OPTION.name}</div>
                <p className="text-sm text-ink-soft leading-relaxed flex-1">{OTHER_OPTION.description}</p>
                <div className="font-mono text-sm pt-1 border-t border-line text-ink-faint">Custom quote</div>
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && !selectedPackage && (
        <p className="text-ink-faint">Loading…</p>
      )}

      {step === 2 && selectedPackage && (
        <div>
          <button onClick={() => setStep(1)} className="text-sm text-ink-soft hover:text-ink mb-4 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Change session
          </button>

          <h1 className="font-display text-2xl mb-1">Pick a date</h1>
          <p className="text-sm text-ink-soft mb-5">{selectedPackage.name} · {selectedPackage.price != null ? `$${selectedPackage.price.toLocaleString()}` : 'Custom quote'}</p>

          {isMultiDay && (
            <p className="text-sm text-ink-soft mb-3 bg-paper-sunken border border-line rounded px-3 py-2">
              Multi-day wedding — select every day you'd like coverage (ceremony, other events, reception, etc.). Each day is full coverage.
            </p>
          )}
          {!isMultiDay && isFullDay && (
            <p className="text-sm text-ink-soft mb-3 bg-paper-sunken border border-line rounded px-3 py-2">
              This session books out the full day.
            </p>
          )}

          <div className="border border-line rounded-md p-4 bg-paper-raised">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setMonth(m => addMonths(m, -1))} className="p-1.5 hover:bg-paper-sunken rounded" aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-display text-base">{format(month, 'MMMM yyyy')}</span>
              <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-paper-sunken rounded" aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="font-mono text-[10px] text-ink-faint uppercase py-1">{d}</div>
              ))}
              {calendarDays.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const inMonth = isSameMonth(d, month);
                const isPast = isBefore(d, today);
                const isUnavailable = unavailable.has(dateStr);
                const isSelected = selectedDates.some(x => isSameDay(x, d));
                // While availability for this month is still loading, treat days as not-yet-known
                // (disabled, neutral) rather than assuming they're open to click.
                const isUnknown = inMonth && !isPast && availabilityLoading;
                const disabled = !inMonth || isPast || isUnavailable || isUnknown;
                return (
                  <button key={dateStr} disabled={disabled} onClick={() => toggleDate(d)}
                    className={`aspect-square rounded text-sm flex items-center justify-center
                      ${!inMonth ? 'text-transparent pointer-events-none' : ''}
                      ${isSelected ? 'bg-accent text-white font-bold'
                        : isUnknown ? 'text-ink-faint opacity-40'
                        : disabled ? 'text-ink-faint line-through opacity-40'
                        : 'bg-confirmed-soft text-confirmed font-semibold hover:opacity-80'}`}>
                    {format(d, 'd')}
                  </button>
                );
              })}
            </div>
          </div>

          {isMultiDay && sortedSelected.length > 0 && (
            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-wider text-ink-faint">Selected days — what's happening each day? (optional)</label>
              {sortedSelected.map((d) => {
                const key = format(d, 'yyyy-MM-dd');
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24 shrink-0">{format(d, 'MMM d, yyyy')}</span>
                    <input value={dayLabels[key] || ''} onChange={e => setDayLabels(l => ({ ...l, [key]: e.target.value }))}
                      placeholder="e.g. Mehendi, Wedding Ceremony, Reception"
                      className="flex-1 border border-line-strong rounded px-2.5 py-1.5 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-accent" />
                    <button onClick={() => removeDate(d)} className="text-ink-faint hover:text-declined shrink-0" aria-label={`Remove ${key}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!isFullDay && selectedDates.length > 0 && (
            <div className="mt-4">
              <label className="text-xs uppercase tracking-wider text-ink-faint">Time</label>
              {slotsLoading ? (
                <p className="text-sm text-ink-faint mt-1.5">Checking availability…</p>
              ) : timeSlots.length === 0 ? (
                <p className="text-sm text-ink-faint mt-1.5">No times available this day.</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap mt-1.5">
                    {timeSlots.map(({ time, available }) => (
                      <button key={time} disabled={!available} onClick={() => setSelectedTime(time)}
                        className={`border rounded px-3 py-1.5 text-sm
                          ${selectedTime === time ? 'bg-accent border-accent text-white'
                            : !available ? 'text-ink-faint line-through opacity-40 border-line cursor-not-allowed'
                            : 'border-line-strong hover:bg-paper-sunken'}`}>
                        {formatTime(time)}
                      </button>
                    ))}
                  </div>
                  {timeSlots.some(s => !s.available) && (
                    <p className="text-xs text-ink-faint mt-1.5">Some times are already booked that day.</p>
                  )}
                </>
              )}
            </div>
          )}

          <button onClick={() => setStep(3)} disabled={!canContinueToDetails}
            className="mt-7 w-full sm:w-auto bg-accent disabled:opacity-40 text-white text-sm font-semibold px-6 py-3 rounded">
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <button onClick={() => setStep(2)} className="text-sm text-ink-soft hover:text-ink mb-4 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Change date
          </button>

          <h1 className="font-display text-2xl mb-1">Your details</h1>
          <p className="text-sm text-ink-soft mb-5">
            {selectedPackage?.name} · {sortedSelected.length > 1
              ? `${sortedSelected.length} days (${format(sortedSelected[0], 'MMM d')} – ${format(sortedSelected[sortedSelected.length - 1], 'MMM d, yyyy')})`
              : `${sortedSelected[0] && format(sortedSelected[0], 'MMM d, yyyy')} · ${timeSummary}`
            }
          </p>

          <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-4">
            {isOther && (
              <div>
                <label htmlFor="bf-other-desc" className="text-xs uppercase tracking-wider text-ink-faint">What are you looking for?</label>
                <textarea id="bf-other-desc" required rows={3} value={otherDescription} onChange={e => setOtherDescription(e.target.value)}
                  placeholder="e.g. Family pet photoshoot at the park, headshots for 3 people, product photography for a small business…"
                  className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
                {otherDescription.length > 0 && otherDescription.trim().length < 10 && (
                  <p className="text-xs text-ink-faint mt-1">A few more details would help — what kind of session is this?</p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="bf-name" className="text-xs uppercase tracking-wider text-ink-faint">Full name</label>
              <input id="bf-name" required value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="Priya Shah"
                className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bf-email" className="text-xs uppercase tracking-wider text-ink-faint">Email</label>
                <input id="bf-email" required type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  placeholder="priya@email.com"
                  className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label htmlFor="bf-phone" className="text-xs uppercase tracking-wider text-ink-faint">Phone</label>
                <input id="bf-phone" value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                  placeholder="(555) 019-2043"
                  className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>
            <div>
              <label htmlFor="bf-location" className="text-xs uppercase tracking-wider text-ink-faint">Location</label>
              <input id="bf-location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Riverside Park, Austin"
                className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label htmlFor="bf-notes" className="text-xs uppercase tracking-wider text-ink-faint">Anything we should know? (optional)</label>
              <textarea id="bf-notes" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1.5 border border-line-strong rounded px-3 py-2.5 text-sm bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            {/* Honeypot — invisible to real visitors, catches simple bots */}
            <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off"
                value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>

            {error && <p className="text-sm text-declined">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting || !canSubmit}
                className="flex-1 sm:flex-none bg-accent disabled:opacity-60 text-white text-sm font-semibold px-6 py-3 rounded">
                {submitting ? 'Sending…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
