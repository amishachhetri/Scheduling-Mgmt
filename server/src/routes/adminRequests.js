const express = require('express');
const router = express.Router();
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { sendTemplateEmail } = require('../services/email');
const { finalizeApprovedBooking } = require('../services/bookingLifecycle');
const availability = require('../services/availability');

router.get('/', async (req, res) => {
  const requests = await db.all("SELECT * FROM bookings WHERE status = 'Requested' ORDER BY created_at ASC");
  const withDetails = await Promise.all(requests.map(async r => ({
    ...r,
    has_conflict: (await availability.findTimeConflicts(r.shoot_date, r.shoot_time, r.id, await availability.resolveDurationMinutes(r))).length > 0,
    events: await db.all('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC', [r.id])
  })));
  res.json(withDetails);
});

router.get('/:id', async (req, res) => {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  booking.events = await db.all('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC', [req.params.id]);
  res.json(booking);
});

router.post('/:id/approve', async (req, res) => {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status !== 'Requested') return res.status(409).json({ error: 'This request has already been handled' });

  await db.run(`UPDATE bookings SET status = 'Upcoming', updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.params.id, 'approved', 'Request approved.']);

  const finalized = await finalizeApprovedBooking(req.params.id);
  res.json({ booking: finalized });
});

router.post('/:id/deny', async (req, res) => {
  const { reason } = req.body;
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status !== 'Requested') return res.status(409).json({ error: 'This request has already been handled' });

  await db.run(`UPDATE bookings SET status = 'Denied', updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  await db.run('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.params.id, 'denied', reason || 'Request denied.']);

  sendTemplateEmail('booking_request_denied', {
    booking_id: booking.id, client_id: booking.client_id, client_name: booking.client_name, client_email: booking.client_email,
    shoot_type: booking.shoot_type, shoot_date: booking.shoot_date,
    denial_reason: reason || ''
  }).catch(console.error);

  const denied = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  res.json({ booking: denied });
});

module.exports = router;
