const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { sendTemplateEmail } = require('../services/email');
const availability = require('../services/availability');
const { generateReferenceCode, generateUniqueReferenceCode } = require('../services/referenceCode');

const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests submitted. Please try again later.' }
});
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many lookups. Please try again later.' }
});
router.use(readLimiter);

// GET /api/public/profile — whitelisted subset only, never SMTP/OAuth fields
router.get('/profile', async (req, res) => {
  const profile = await db.get(
    'SELECT business_name, name, bio, avatar_url, cover_photo_url, instagram_url FROM photographer_profile WHERE id = 1'
  );
  res.json(profile || { business_name: 'Photography Studio', name: null, bio: null, avatar_url: null, cover_photo_url: null, instagram_url: null });
});

// GET /api/public/packages — explicit column whitelist, never SELECT *
router.get('/packages', async (req, res) => {
  const packages = await db.all(
    'SELECT id, name, description, price, shoot_type, is_full_day, duration_minutes FROM packages WHERE archived = 0 ORDER BY shoot_type, price'
  );
  res.json(packages);
});

// GET /api/public/media?type=photo|video — whitelisted subset only, never public_id (that's a management detail)
router.get('/media', async (req, res) => {
  const { type } = req.query;
  const rows = type
    ? await db.all('SELECT id, type, category, title, url, thumbnail_url, featured FROM portfolio_media WHERE type = ? ORDER BY sort_order ASC, created_at DESC', [type])
    : await db.all('SELECT id, type, category, title, url, thumbnail_url, featured FROM portfolio_media ORDER BY sort_order ASC, created_at DESC');
  res.json(rows);
});

// GET /api/public/availability?start=YYYY-MM-DD&end=YYYY-MM-DD&package_id=X — busy/available
// only, never booking details. `package_id` lets us apply the right rule: full-day packages
// (weddings) need the ENTIRE day free, timed packages only need their own duration to fit.
router.get('/availability', async (req, res) => {
  const { start, end, package_id } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  let durationMinutes, fullDayRequest;
  if (package_id) {
    const pkg = await db.get('SELECT is_full_day, duration_minutes FROM packages WHERE id = ?', [package_id]);
    if (pkg) { fullDayRequest = !!pkg.is_full_day; durationMinutes = pkg.duration_minutes; }
  }
  res.json({ unavailable_dates: await availability.getUnavailableDates(start, end, { durationMinutes, fullDayRequest }) });
});

// GET /api/public/availability/slots?date=YYYY-MM-DD&package_id=X — every candidate start time
// for this package's session length on this date, each flagged available or not (already taken
// by an existing booking/block once its own duration + the travel buffer are accounted for).
router.get('/availability/slots', async (req, res) => {
  const { date, package_id } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  let durationMinutes;
  if (package_id) {
    const pkg = await db.get('SELECT duration_minutes FROM packages WHERE id = ?', [package_id]);
    durationMinutes = pkg?.duration_minutes;
  }
  res.json({ slots: await availability.getSlotsWithAvailability(date, durationMinutes) });
});

// GET /api/public/booking-status?email=&code= — public-safe status + pre-shoot task lookup.
// Requires both fields (not just the code) so a leaked/guessed reference code alone can't
// pull up someone else's booking.
router.get('/booking-status', statusLimiter, async (req, res) => {
  const { email, code } = req.query;
  if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

  const booking = await db.get(
    'SELECT * FROM bookings WHERE reference_code = ? AND LOWER(client_email) = LOWER(?) AND deleted_at IS NULL', [code.trim(), email.trim()]
  );

  if (!booking) return res.status(404).json({ error: "We couldn't find a request with that reference code and email." });

  let denial_reason = null;
  if (booking.status === 'Denied') {
    const note = await db.get(
      "SELECT note FROM workflow_notes WHERE booking_id = ? AND stage = 'denied' ORDER BY created_at DESC LIMIT 1", [booking.id]
    );
    denial_reason = note?.note || null;
  }

  const events = await db.all('SELECT event_name, event_date FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC', [booking.id]);

  res.json({
    reference_code: booking.reference_code,
    status: booking.status,
    shoot_type: booking.shoot_type,
    shoot_type_detail: booking.shoot_type_detail,
    shoot_date: booking.shoot_date,
    shoot_time: booking.shoot_time,
    shoot_end_time: booking.shoot_end_time,
    location: booking.location,
    package_name: booking.package_name,
    package_price: booking.package_price,
    deposit_received: !!booking.deposit_received,
    deposit_amount: booking.deposit_amount,
    balance_due: booking.balance_due,
    contract_signed: !!booking.contract_signed,
    gallery_link: booking.gallery_link,
    denial_reason,
    events
  });
});

// POST /api/public/booking-requests
router.post('/booking-requests', submitLimiter, async (req, res) => {
  const {
    client_name, client_email, client_phone,
    shoot_type, shoot_type_detail, shoot_date, shoot_time, shoot_end_time, location,
    package_id, notes, events, website // `website` = honeypot field, must stay empty
  } = req.body;

  if (website) {
    // Likely a bot -- pretend success without writing anything.
    return res.json({ booking: { id: uuidv4(), reference_code: generateReferenceCode(), status: 'Requested' } });
  }

  if (!client_name || !client_email || !shoot_type || !shoot_date || !shoot_time) {
    return res.status(400).json({ error: 'client_name, client_email, shoot_type, shoot_date, and shoot_time are required' });
  }

  const isOtherRequest = shoot_type === 'Other';
  if (!isOtherRequest && !package_id) {
    return res.status(400).json({ error: 'package_id is required' });
  }
  if (isOtherRequest && (!shoot_type_detail || shoot_type_detail.trim().length < 10)) {
    return res.status(400).json({ error: 'Please describe what kind of session you\'re looking for (at least a few words).' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (shoot_date < todayStr) {
    return res.status(400).json({ error: 'shoot_date cannot be in the past' });
  }

  // Never trust a client-submitted price -- derive it server-side. "Other" requests have
  // no package at all -- price is quoted by the photographer after reviewing the request.
  let pkg = { id: null, name: null, price: 0, is_full_day: 0, duration_minutes: null };
  if (!isOtherRequest) {
    const found = await db.get('SELECT * FROM packages WHERE id = ? AND archived = 0', [package_id]);
    if (!found) return res.status(400).json({ error: 'Invalid package selected' });
    pkg = found;
  }

  // Additional wedding days (multi-day packages) -- capped and validated like the primary date.
  const cleanEvents = Array.isArray(events)
    ? events
        .filter(ev => ev && ev.event_date && ev.event_date >= todayStr)
        .slice(0, 10)
        .map(ev => ({ event_name: (ev.event_name || 'Additional day').slice(0, 80), event_date: ev.event_date }))
    : [];

  // Never trust client-submitted times either -- recompute from the package's own rules so a
  // tampered payload can't claim a shorter/longer session than the package actually allows.
  const isFullDayBooking = !!pkg.is_full_day;
  let resolvedShootTime, resolvedShootEndTime, sessionDuration;
  if (isFullDayBooking) {
    resolvedShootTime = availability.BUSINESS_START;
    resolvedShootEndTime = availability.BUSINESS_END;
  } else {
    sessionDuration = pkg.duration_minutes || availability.DEFAULT_DURATION_MINUTES;
    if (!availability.isValidSlotStart(shoot_time, sessionDuration)) {
      return res.status(400).json({ error: 'Please pick a valid time slot for this session.' });
    }
    resolvedShootTime = shoot_time;
    resolvedShootEndTime = availability.addMinutesToTime(shoot_time, sessionDuration);
  }

  // Re-check availability at submission time (not just page-load time) so two people can't
  // both land on a slot/day that only had room for one.
  if (isFullDayBooking) {
    const datesToCheck = [shoot_date, ...cleanEvents.map(ev => ev.event_date)];
    let conflictDate = null;
    for (const d of datesToCheck) {
      if (await availability.hasAnyCommitment(d)) { conflictDate = d; break; }
    }
    if (conflictDate) {
      return res.status(409).json({ error: `${conflictDate} is no longer available. Please pick a different date.` });
    }
  } else if ((await availability.findTimeConflicts(shoot_date, resolvedShootTime, undefined, sessionDuration)).length > 0) {
    return res.status(409).json({ error: 'That time was just booked by someone else. Please pick another.' });
  }

  let client = await db.get('SELECT * FROM clients WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL', [client_name]);
  const clientId = client?.id || uuidv4();
  if (!client) {
    await db.run('INSERT INTO clients (id, name, email, phone) VALUES (?, ?, ?, ?)', [clientId, client_name, client_email, client_phone]);
  } else {
    await db.run(`UPDATE clients SET email = COALESCE(?, email), phone = COALESCE(?, phone), updated_at = ${NOW_TS} WHERE id = ?`, [client_email, client_phone, clientId]);
  }

  const bookingId = uuidv4();
  const referenceCode = await generateUniqueReferenceCode();

  await db.run(`
    INSERT INTO bookings (
      id, client_id, client_name, client_email, client_phone,
      shoot_type, shoot_type_detail, shoot_date, shoot_time, shoot_end_time, location,
      package_id, package_name, package_price, balance_due, notes,
      status, workflow_stage, source, reference_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Requested', 'Shoot scheduled', 'public_request', ?)
  `, [
    bookingId, clientId, client_name, client_email, client_phone,
    shoot_type, shoot_type_detail || null, shoot_date, resolvedShootTime, resolvedShootEndTime, location || null,
    pkg.id, pkg.name, pkg.price, pkg.price, notes || null,
    referenceCode
  ]);

  if (cleanEvents.length > 0) {
    for (const ev of cleanEvents) {
      await db.run('INSERT INTO booking_events (id, booking_id, event_name, event_date) VALUES (?, ?, ?, ?)',
        [uuidv4(), bookingId, ev.event_name, ev.event_date]);
    }
  }

  await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
    [uuidv4(), bookingId, 'requested', 'Submitted via public booking request.']);

  const profile = await db.get('SELECT * FROM photographer_profile WHERE id = 1');

  sendTemplateEmail('booking_request_received', {
    booking_id: bookingId, client_id: clientId, client_name, client_email,
    shoot_type, shoot_date, shoot_time: resolvedShootTime, reference_code: referenceCode
  }).catch(console.error);

  sendTemplateEmail('new_request_notification', {
    booking_id: bookingId, client_id: clientId, client_name, client_email, client_phone,
    shoot_type, shoot_date, shoot_time: resolvedShootTime, location, to_email: profile?.email
  }).catch(console.error);

  res.json({ booking: { id: bookingId, reference_code: referenceCode, status: 'Requested', shoot_type, shoot_date, shoot_time: resolvedShootTime, package_name: pkg.name } });
});

module.exports = router;
