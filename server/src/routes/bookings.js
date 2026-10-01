const express = require('express');
const router = express.Router();
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const gcal = require('../services/googleCalendar');
const availability = require('../services/availability');
const { finalizeApprovedBooking } = require('../services/bookingLifecycle');
const { sendTemplateEmail } = require('../services/email');
const cloudinary = require('../services/cloudinary');

const STAGES = [
  'Shoot scheduled',
  'Deposit received',
  'Shoot completed',
  'Sent to client for selection',
  'Editing in progress',
  'Editing complete',
  'Final products delivered',
  'Project closed'
];

router.get('/', async (req, res) => {
  const { status, shoot_type, client_id, sort } = req.query;
  let q = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];
  if (status) { q += ' AND status = ?'; params.push(status); }
  if (shoot_type) { q += ' AND shoot_type = ?'; params.push(shoot_type); }
  if (client_id) { q += ' AND client_id = ?'; params.push(client_id); }
  if (sort === 'recent') {
    q += ' ORDER BY COALESCE(updated_at, created_at) DESC';
  } else {
    // Default: soonest upcoming first
    q += ' ORDER BY shoot_date ASC, shoot_time ASC';
  }
  res.json(await db.all(q, params));
});

router.get('/:id', async (req, res) => {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  booking.second_shooters = await db.all('SELECT * FROM second_shooters WHERE booking_id = ?', [req.params.id]);
  booking.workflow_notes = await db.all('SELECT * FROM workflow_notes WHERE booking_id = ? ORDER BY created_at ASC', [req.params.id]);
  booking.expenses = await db.all('SELECT * FROM expenses WHERE booking_id = ?', [req.params.id]);
  booking.messages = await db.all('SELECT * FROM message_log WHERE booking_id = ? ORDER BY sent_at DESC', [req.params.id]);
  booking.events = await db.all('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC', [req.params.id]);
  res.json(booking);
});

router.post('/', async (req, res) => {
  const {
    client_name, client_email, client_phone,
    shoot_type, shoot_type_detail, shoot_date, shoot_time, shoot_end_time, location,
    package_id, package_name, package_price, discount, deposit_amount, deposit_received,
    notes, status, second_shooters, events
  } = req.body;

  if (!client_name || !shoot_type || !shoot_date || !shoot_time) {
    return res.status(400).json({ error: 'client_name, shoot_type, shoot_date, shoot_time required' });
  }
  for (const [field, val] of [['package_price', package_price], ['discount', discount], ['deposit_amount', deposit_amount]]) {
    if (val !== undefined && val !== null && val !== '' && parseFloat(val) < 0) {
      return res.status(400).json({ error: `${field} cannot be negative` });
    }
  }

  // Scheduling conflict check, using this booking's actual session length (from its package,
  // an explicit end time, or the generic default) plus the travel-time buffer.
  const newDuration = await availability.resolveDurationMinutes({ shoot_time, shoot_end_time, package_id });
  const conflicts = await availability.findTimeConflicts(shoot_date, shoot_time, undefined, newDuration);

  // Upsert client
  let client = await db.get('SELECT * FROM clients WHERE LOWER(name) = LOWER(?)', [client_name]);
  const clientId = client?.id || uuidv4();
  if (!client) {
    await db.run('INSERT INTO clients (id, name, email, phone) VALUES (?, ?, ?, ?)', [clientId, client_name, client_email, client_phone]);
  } else {
    await db.run(`UPDATE clients SET email = COALESCE(?, email), phone = COALESCE(?, phone), updated_at = ${NOW_TS} WHERE id = ?`, [client_email, client_phone, clientId]);
  }

  const price = parseFloat(package_price) || 0;
  const disc = parseFloat(discount) || 0;
  const deposit = parseFloat(deposit_amount) || 0;
  const balance = Math.max(0, price - disc - deposit);
  const bookingId = uuidv4();
  const bookingStatus = status || 'Upcoming';

  await db.run(`
    INSERT INTO bookings (
      id, client_id, client_name, client_email, client_phone,
      shoot_type, shoot_type_detail, shoot_date, shoot_time, shoot_end_time, location,
      package_id, package_name, package_price, discount, deposit_amount, deposit_received,
      balance_due, notes, status, workflow_stage, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Shoot scheduled', ?)
  `, [
    bookingId, clientId, client_name, client_email, client_phone,
    shoot_type, shoot_type_detail || null, shoot_date, shoot_time, shoot_end_time || null, location,
    package_id || null, package_name || null, price, disc, deposit,
    deposit_received ? 1 : 0, balance, notes || null, bookingStatus, req.body.source || 'manual'
  ]);

  // Multi-day events
  if (events && events.length > 0) {
    for (const ev of events) {
      if (ev.event_name && ev.event_date) {
        await db.run('INSERT INTO booking_events (id, booking_id, event_name, event_date, event_time) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), bookingId, ev.event_name, ev.event_date, ev.event_time || null]);
      }
    }
  }

  // Assistants
  if (second_shooters && second_shooters.length > 0) {
    for (const ss of second_shooters) {
      await db.run('INSERT INTO second_shooters (id, booking_id, name, role, pay_amount, pay_type) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), bookingId, ss.name, ss.role || 'Assistant Photographer', ss.pay_amount || 0, ss.pay_type || 'flat']);
    }
  }

  // Awaited (unlike the fire-and-forget email/SMS calls inside it, which stay backgrounded) --
  // with async db calls, not waiting here would race the SELECT below: the reference_code it
  // assigns wouldn't reliably have landed yet by the time this response is built.
  await finalizeApprovedBooking(bookingId).catch(console.error);

  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  res.json({ booking, conflicts: conflicts.length > 0 ? conflicts : [] });
});

router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    client_name, client_email, client_phone,
    shoot_type, shoot_type_detail, shoot_date, shoot_time, shoot_end_time, location,
    package_id, package_name, package_price, discount, deposit_amount, deposit_received,
    notes, status, gallery_link, contract_signed, second_shooters
  } = req.body;

  for (const [field, val] of [['package_price', package_price], ['discount', discount], ['deposit_amount', deposit_amount]]) {
    if (val !== undefined && val !== null && val !== '' && parseFloat(val) < 0) {
      return res.status(400).json({ error: `${field} cannot be negative` });
    }
  }

  const price = package_price !== undefined ? parseFloat(package_price) : existing.package_price;
  const disc = discount !== undefined ? parseFloat(discount) : (existing.discount || 0);
  const deposit = deposit_amount !== undefined ? parseFloat(deposit_amount) : existing.deposit_amount;
  const balance = Math.max(0, price - disc - deposit);
  const depositNowReceived = deposit_received !== undefined ? (deposit_received ? 1 : 0) : existing.deposit_received;

  // Checking "deposit received" auto-advances a booking still sitting at the very first stage --
  // but never rewinds one that's already further along, since that stage's own history already
  // accounts for the deposit however it actually happened.
  const justReceivedDeposit = depositNowReceived === 1 && !existing.deposit_received;
  const shouldAdvanceStage = justReceivedDeposit && existing.workflow_stage === STAGES[0];
  const newStage = shouldAdvanceStage ? STAGES[1] : existing.workflow_stage;

  await db.run(`
    UPDATE bookings SET
      client_name = ?, client_email = ?, client_phone = ?,
      shoot_type = ?, shoot_type_detail = ?, shoot_date = ?, shoot_time = ?, shoot_end_time = ?, location = ?,
      package_id = ?, package_name = ?, package_price = ?, discount = ?,
      deposit_amount = ?, deposit_received = ?, balance_due = ?,
      notes = ?, status = ?,
      gallery_link = COALESCE(?, gallery_link),
      contract_signed = COALESCE(?, contract_signed),
      workflow_stage = ?,
      workflow_stage_updated_at = CASE WHEN ? THEN ${NOW_TS} ELSE workflow_stage_updated_at END,
      updated_at = ${NOW_TS}
    WHERE id = ?
  `, [
    client_name ?? existing.client_name, client_email ?? existing.client_email, client_phone ?? existing.client_phone,
    shoot_type ?? existing.shoot_type, shoot_type_detail ?? existing.shoot_type_detail,
    shoot_date ?? existing.shoot_date, shoot_time ?? existing.shoot_time,
    shoot_end_time ?? existing.shoot_end_time, location ?? existing.location,
    package_id ?? existing.package_id, package_name ?? existing.package_name, price, disc,
    deposit, depositNowReceived, balance,
    notes ?? existing.notes, status ?? existing.status,
    gallery_link ?? null, contract_signed !== undefined ? (contract_signed ? 1 : 0) : null,
    newStage, shouldAdvanceStage,
    req.params.id
  ]);

  if (shouldAdvanceStage) {
    await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, STAGES[1], 'Deposit marked received — advanced to Deposit received.']);
  }

  // Sync money owed
  const moe = await db.get('SELECT * FROM money_owed WHERE booking_id = ? AND paid = 0', [req.params.id]);
  if (moe) {
    if (balance <= 0) {
      await db.run(`UPDATE money_owed SET paid = 1, paid_at = ${NOW_TS} WHERE id = ?`, [moe.id]);
    } else {
      await db.run('UPDATE money_owed SET amount = ? WHERE id = ?', [balance, moe.id]);
    }
  } else if (balance > 0 && existing.balance_due <= 0) {
    // Balance was 0, now has balance
    await db.run("INSERT INTO money_owed (id, booking_id, name, amount, notes, type) VALUES (?, ?, ?, ?, ?, 'booking')",
      [uuidv4(), req.params.id, existing.client_name, balance, `Balance for ${existing.shoot_type} shoot`]);
  }

  if (second_shooters) {
    await db.run('DELETE FROM second_shooters WHERE booking_id = ?', [req.params.id]);
    for (const ss of second_shooters) {
      await db.run('INSERT INTO second_shooters (id, booking_id, name, role, pay_amount, pay_type) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), req.params.id, ss.name, ss.role || 'Assistant Photographer', ss.pay_amount || 0, ss.pay_type || 'flat']);
    }
  }

  const updatedBooking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  gcal.updateEvent(updatedBooking).catch(console.error);
  res.json(updatedBooking);
});

// Reschedule endpoint — logs old→new date in workflow_notes, updates Google Calendar
router.put('/:id/reschedule', async (req, res) => {
  const { shoot_date, shoot_time, shoot_end_time, note, event_id } = req.body;
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });

  if (event_id) {
    // Reschedule a single multi-day event
    const ev = await db.get('SELECT * FROM booking_events WHERE id = ?', [event_id]);
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    const oldDate = ev.event_date;
    await db.run('UPDATE booking_events SET event_date = ?, event_time = ? WHERE id = ?',
      [shoot_date || ev.event_date, shoot_time || ev.event_time, event_id]);
    const logNote = `Event "${ev.event_name}" rescheduled: ${oldDate} → ${shoot_date}${note ? `. ${note}` : ''}`;
    await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)', [uuidv4(), req.params.id, 'rescheduled', logNote]);
    await db.run(`UPDATE bookings SET updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
    return res.json({ ok: true, event: await db.get('SELECT * FROM booking_events WHERE id = ?', [event_id]) });
  }

  const oldDate = booking.shoot_date;
  const oldTime = booking.shoot_time;
  const newDate = shoot_date || oldDate;
  const newTime = shoot_time || oldTime;
  const newEnd  = shoot_end_time || booking.shoot_end_time;

  // Same conflict check the create flow runs, excluding this booking itself -- flags (but
  // doesn't block) a reschedule that lands on top of another live booking.
  const newDuration = await availability.resolveDurationMinutes({ shoot_time: newTime, shoot_end_time: newEnd, package_id: booking.package_id });
  const conflicts = await availability.findTimeConflicts(newDate, newTime, req.params.id, newDuration);

  await db.run(`UPDATE bookings SET shoot_date = ?, shoot_time = ?, shoot_end_time = ?, updated_at = ${NOW_TS} WHERE id = ?`,
    [newDate, newTime, newEnd, req.params.id]);

  const logNote = `Rescheduled: ${oldDate} ${oldTime} → ${newDate} ${newTime}${note ? `. ${note}` : ''}`;
  await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)', [uuidv4(), req.params.id, 'rescheduled', logNote]);

  const rescheduled = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  gcal.updateEvent(rescheduled).catch(console.error);
  res.json({ ...rescheduled, conflicts });
});

// Cancel with deposit decision
router.put('/:id/cancel', async (req, res) => {
  const { cancellation_note, deposit_decision } = req.body;
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });

  await db.run(`UPDATE bookings SET status = 'Cancelled', cancellation_note = ?, deposit_decision = ?, updated_at = ${NOW_TS} WHERE id = ?`,
    [cancellation_note || null, deposit_decision || 'pending', req.params.id]);

  // Flag unpaid money_owed entries
  await db.run("UPDATE money_owed SET notes = CASE WHEN notes IS NULL THEN 'Booking cancelled — review this entry' ELSE notes || ' | Booking cancelled — review this entry' END WHERE booking_id = ? AND paid = 0",
    [req.params.id]);

  if (deposit_decision === 'keep') {
    // Mark deposit as "received income" — balance_due already includes this, no change needed
    await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'cancelled', `Booking cancelled. Deposit of $${booking.deposit_amount} kept as income.${cancellation_note ? ' ' + cancellation_note : ''}`]);
  } else if (deposit_decision === 'refund') {
    await db.run(`UPDATE bookings SET deposit_received = 0, deposit_amount = 0, updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
    await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
      [uuidv4(), req.params.id, 'cancelled', `Booking cancelled. Deposit refunded.${cancellation_note ? ' ' + cancellation_note : ''}`]);
  } else {
    if (cancellation_note) {
      await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)', [uuidv4(), req.params.id, 'cancelled', cancellation_note]);
    }
  }

  const cancelled = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  gcal.updateEvent(cancelled).catch(console.error);
  res.json(cancelled);
});

router.put('/:id/workflow', async (req, res) => {
  const { stage, note, gallery_link } = req.body;
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  let newStatus = null;
  let galleryDeliveredAt = null;
  let depositReceived = null;

  if (stage === 'Project closed') newStatus = 'Completed';

  // Advancing through this stage IS the record that the deposit was collected -- it feeds
  // the existing deposit_received-gated income calc on the Reports page (dashboard.js
  // GET /business), so this is what "connects the step to finances."
  if (stage === 'Deposit received') depositReceived = 1;

  if (stage === 'Final products delivered' && gallery_link) {
    galleryDeliveredAt = now;
    sendTemplateEmail('gallery_ready', {
      booking_id: req.params.id, client_id: booking.client_id,
      client_name: booking.client_name, client_email: booking.client_email, gallery_link
    }).catch(console.error);
  }

  if (stage === 'Project closed') {
    sendTemplateEmail('review_request', {
      booking_id: req.params.id, client_id: booking.client_id,
      client_name: booking.client_name, client_email: booking.client_email
    }, 3).catch(console.error);
    // Credit the full contracted amount (price minus discount) when project is closed
    const contractedAmount = (booking.package_price || 0) - (booking.discount || 0);
    await db.run('UPDATE clients SET total_spent = total_spent + ? WHERE id = ?', [contractedAmount, booking.client_id]);
  }

  await db.run(`
    UPDATE bookings SET
      workflow_stage = ?, workflow_stage_updated_at = ?,
      status = COALESCE(?, status),
      gallery_link = COALESCE(?, gallery_link),
      gallery_delivered_at = COALESCE(?, gallery_delivered_at),
      deposit_received = COALESCE(?, deposit_received),
      updated_at = ${NOW_TS}
    WHERE id = ?
  `, [stage, now, newStatus, gallery_link || null, galleryDeliveredAt, depositReceived, req.params.id]);

  if (note) {
    await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)', [uuidv4(), req.params.id, stage, note]);
  }

  await db.run("DELETE FROM reminders WHERE booking_id = ? AND type = 'workflow_stuck'", [req.params.id]);

  const afterWorkflow = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  gcal.updateEvent(afterWorkflow).catch(console.error);
  res.json(afterWorkflow);
});

router.delete('/:id', async (req, res) => {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  gcal.deleteEvent(booking).catch(console.error);
  // Children first -- FK constraints reject deleting a bookings row while these still reference it.
  const galleries = await db.all('SELECT * FROM galleries WHERE booking_id = ?', [req.params.id]);
  for (const gallery of galleries) {
    const photos = await db.all('SELECT * FROM gallery_photos WHERE gallery_id = ?', [gallery.id]);
    await db.run('DELETE FROM gallery_photos WHERE gallery_id = ?', [gallery.id]);
    if (cloudinary.isConfigured()) {
      for (const p of photos) {
        if (p.public_id) cloudinary.deleteAsset(p.public_id, p.resource_type || 'image').catch(console.error);
      }
    }
  }
  await db.run('DELETE FROM galleries WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM second_shooters WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM workflow_notes WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM money_owed WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM reminders WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM booking_events WHERE booking_id = ?', [req.params.id]);
  await db.run('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  await db.run('UPDATE clients SET total_shoots = GREATEST(0, total_shoots - 1) WHERE id = ?', [booking.client_id]);
  res.json({ success: true });
});

module.exports = router;
