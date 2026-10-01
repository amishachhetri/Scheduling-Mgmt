const { db } = require('../db/schema');

// Business-hours bounds used to generate candidate booking start times. Matches the fixed
// "Full Day" window used elsewhere for full-day packages (FULL_DAY_START/END in
// client/src/utils/helpers.js) so a full-day shoot's implied span lines up with the same clock.
const BUSINESS_START = '08:00';
const BUSINESS_END = '20:00';
const SLOT_STEP_MINUTES = 30;
// Fallback session length when a booking has no resolvable package/duration on file
// (e.g. a custom "Other" request, or a package created before durations existed).
const DEFAULT_DURATION_MINUTES = 120;

function getBufferMinutes() {
  const profile = db.prepare('SELECT buffer_hours FROM photographer_profile WHERE id = 1').get();
  return (profile?.buffer_hours || 2) * 60;
}

function toMinutes(hhmm) {
  return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10);
}

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToTime(hhmm, minutes) {
  return minutesToHHMM(toMinutes(hhmm) + minutes);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// A slot start is only offerable if the whole [start, start+duration] session fits inside
// business hours and lands on the same grid the candidate-slot generator uses.
function isValidSlotStart(hhmm, durationMinutes) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const start = toMinutes(hhmm);
  return start >= toMinutes(BUSINESS_START)
    && (start + durationMinutes) <= toMinutes(BUSINESS_END)
    && start % SLOT_STEP_MINUTES === 0;
}

// Real duration of an existing booking: prefer its actual recorded end time if set (covers
// full-day/custom/multi-day bookings), else its package's configured duration, else the
// generic default. `booking` may come from a query joined against packages (duration_minutes
// aliased straight through) or a plain bookings row.
function bookingDurationMinutes(booking) {
  if (booking.shoot_end_time && booking.shoot_time) {
    const d = toMinutes(booking.shoot_end_time) - toMinutes(booking.shoot_time);
    if (d > 0) return d;
  }
  if (booking.duration_minutes != null) return booking.duration_minutes;
  return DEFAULT_DURATION_MINUTES;
}

// Duration to use for a NEW booking/request being evaluated (not yet in the DB) -- prefers an
// explicit shoot_time/shoot_end_time pair, then the chosen package's duration, then the default.
function resolveDurationMinutes({ shoot_time, shoot_end_time, package_id } = {}) {
  if (shoot_end_time && shoot_time) {
    const d = toMinutes(shoot_end_time) - toMinutes(shoot_time);
    if (d > 0) return d;
  }
  if (package_id) {
    const pkg = db.prepare('SELECT duration_minutes FROM packages WHERE id = ?').get(package_id);
    if (pkg?.duration_minutes != null) return pkg.duration_minutes;
  }
  return DEFAULT_DURATION_MINUTES;
}

// Bookings whose [start, end] window (each extended by the travel-time buffer) overlaps the
// candidate [shootTime, shootTime+durationMinutes] window, excluding cancelled/denied bookings
// and (optionally) one booking being edited/approved. Used by the admin manual-booking flow,
// the requests inbox's conflict flag, and public request submission.
function findTimeConflicts(shootDate, shootTime, excludeBookingId, durationMinutes) {
  const buffer = getBufferMinutes();
  const duration = durationMinutes || DEFAULT_DURATION_MINUTES;
  const newStart = toMinutes(shootTime);
  const newEnd = newStart + duration;

  let q = `
    SELECT b.*, p.duration_minutes FROM bookings b
    LEFT JOIN packages p ON b.package_id = p.id
    WHERE b.shoot_date = ?
    AND b.status NOT IN ('Cancelled', 'Denied')
  `;
  const params = [shootDate];
  if (excludeBookingId) {
    q += ' AND b.id != ?';
    params.push(excludeBookingId);
  }

  const candidates = db.prepare(q).all(...params);
  return candidates.filter(b => {
    const existingStart = toMinutes(b.shoot_time);
    const existingEnd = existingStart + bookingDurationMinutes(b);
    return rangesOverlap(newStart - buffer, newEnd + buffer, existingStart, existingEnd);
  });
}

// Literally anything on the calendar that date -- any live booking regardless of its own
// duration, any multi-day wedding extra day, any block (partial or full-day) -- makes the date
// unusable for a NEW full-day request, since a full-day shoot needs the entire day free.
function hasAnyCommitment(dateStr) {
  const anyBooking = db.prepare(`
    SELECT 1 FROM bookings WHERE shoot_date = ? AND status NOT IN ('Cancelled', 'Denied') LIMIT 1
  `).get(dateStr);
  if (anyBooking) return true;

  const eventDay = db.prepare(`
    SELECT 1 FROM booking_events be JOIN bookings b ON be.booking_id = b.id
    WHERE be.event_date = ? AND b.status NOT IN ('Cancelled', 'Denied') LIMIT 1
  `).get(dateStr);
  if (eventDay) return true;

  const anyBlock = db.prepare(`
    SELECT 1 FROM blocked_dates WHERE date <= ? AND COALESCE(end_date, date) >= ? LIMIT 1
  `).get(dateStr, dateStr);
  return !!anyBlock;
}

function generateCandidateSlots(durationMinutes) {
  const slots = [];
  const startMin = toMinutes(BUSINESS_START);
  const latestStart = toMinutes(BUSINESS_END) - durationMinutes;
  for (let t = startMin; t <= latestStart; t += SLOT_STEP_MINUTES) slots.push(minutesToHHMM(t));
  return slots;
}

// Existing bookings/blocks that occupy time on a date, each already extended by the travel
// buffer on both sides -- the set a new candidate slot must not intersect.
function getOccupiedWindows(dateStr) {
  const buffer = getBufferMinutes();
  const windows = [];

  const shortBookings = db.prepare(`
    SELECT b.shoot_time, b.shoot_end_time, p.duration_minutes FROM bookings b
    LEFT JOIN packages p ON b.package_id = p.id
    WHERE b.shoot_date = ? AND b.status NOT IN ('Cancelled', 'Denied')
    AND COALESCE(p.is_full_day, 0) = 0
  `).all(dateStr);
  for (const b of shortBookings) {
    const start = toMinutes(b.shoot_time);
    windows.push({ start: start - buffer, end: start + bookingDurationMinutes(b) + buffer });
  }

  const partialBlocks = db.prepare(`
    SELECT start_time, end_time FROM blocked_dates
    WHERE date <= ? AND COALESCE(end_date, date) >= ?
    AND all_day = 0 AND start_time IS NOT NULL
  `).all(dateStr, dateStr);
  for (const blk of partialBlocks) {
    const s = toMinutes(blk.start_time);
    const e = blk.end_time ? toMinutes(blk.end_time) : s + buffer;
    windows.push({ start: s - buffer, end: e + buffer });
  }

  return windows;
}

// Which of the generated candidate slots (for a given session duration) are already taken on a
// date, accounting for each existing commitment's own span plus travel buffer on both sides.
function getTakenSlots(dateStr, durationMinutes) {
  const duration = durationMinutes || DEFAULT_DURATION_MINUTES;
  const windows = getOccupiedWindows(dateStr);
  const taken = new Set();
  for (const slot of generateCandidateSlots(duration)) {
    const start = toMinutes(slot);
    const end = start + duration;
    if (windows.some(w => rangesOverlap(start, end, w.start, w.end))) taken.add(slot);
  }
  return taken;
}

// Full candidate-slot list for a date/duration, each flagged available or not -- what the
// public booking flow renders as time buttons.
function getSlotsWithAvailability(dateStr, durationMinutes) {
  const duration = durationMinutes || DEFAULT_DURATION_MINUTES;
  const taken = getTakenSlots(dateStr, duration);
  return generateCandidateSlots(duration).map(t => ({ time: t, available: !taken.has(t) }));
}

// A day is fully unavailable for a TIMED (non-full-day) request if: a full-day package booking
// sits on it, it's an extra day of a multi-day wedding, an all-day (or unspecified-time) block
// covers it, or every candidate slot for this session's duration is already taken.
function isFullyBookedDay(dateStr, durationMinutes) {
  const fullDayBooking = db.prepare(`
    SELECT 1 FROM bookings b LEFT JOIN packages p ON b.package_id = p.id
    WHERE b.shoot_date = ? AND b.status NOT IN ('Cancelled', 'Denied')
    AND COALESCE(p.is_full_day, 0) = 1
    LIMIT 1
  `).get(dateStr);
  if (fullDayBooking) return true;

  const eventDay = db.prepare(`
    SELECT 1 FROM booking_events be JOIN bookings b ON be.booking_id = b.id
    WHERE be.event_date = ? AND b.status NOT IN ('Cancelled', 'Denied')
    LIMIT 1
  `).get(dateStr);
  if (eventDay) return true;

  const allDayBlock = db.prepare(`
    SELECT 1 FROM blocked_dates
    WHERE date <= ? AND COALESCE(end_date, date) >= ?
    AND (all_day = 1 OR start_time IS NULL)
    LIMIT 1
  `).get(dateStr, dateStr);
  if (allDayBlock) return true;

  const duration = durationMinutes || DEFAULT_DURATION_MINUTES;
  const candidates = generateCandidateSlots(duration);
  if (candidates.length === 0) return true; // this session doesn't even fit business hours
  return getTakenSlots(dateStr, duration).size >= candidates.length;
}

// Day-level availability for the public calendar. `options.fullDayRequest` (true for weddings)
// requires the ENTIRE day to be free of any commitment; otherwise a day is only unavailable if
// it's blocked at the full-day level or every slot for `options.durationMinutes` is taken.
function getUnavailableDates(startDate, endDate, options = {}) {
  const { durationMinutes, fullDayRequest } = options;
  const dates = [];
  let d = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (d <= end) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  if (fullDayRequest) return dates.filter(hasAnyCommitment);
  return dates.filter(dt => isFullyBookedDay(dt, durationMinutes));
}

module.exports = {
  getBufferMinutes, findTimeConflicts, getUnavailableDates, getTakenSlots, getSlotsWithAvailability,
  resolveDurationMinutes, hasAnyCommitment, addMinutesToTime, isValidSlotStart,
  BUSINESS_START, BUSINESS_END, SLOT_STEP_MINUTES, DEFAULT_DURATION_MINUTES,
};
