const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { sendTemplateEmail } = require('../services/email');
const { finalizeApprovedBooking } = require('../services/bookingLifecycle');
const availability = require('../services/availability');

router.get('/', (req, res) => {
  const requests = db.prepare("SELECT * FROM bookings WHERE status = 'Requested' ORDER BY created_at ASC").all();
  const withDetails = requests.map(r => ({
    ...r,
    has_conflict: availability.findTimeConflicts(r.shoot_date, r.shoot_time, r.id, availability.resolveDurationMinutes(r)).length > 0,
    events: db.prepare('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC').all(r.id)
  }));
  res.json(withDetails);
});

router.get('/:id', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  booking.events = db.prepare('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY event_date ASC').all(req.params.id);
  res.json(booking);
});

router.post('/:id/approve', async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status !== 'Requested') return res.status(409).json({ error: 'This request has already been handled' });

  db.prepare("UPDATE bookings SET status = 'Upcoming', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  db.prepare('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, 'approved', 'Request approved.');

  const finalized = await finalizeApprovedBooking(req.params.id);
  res.json({ booking: finalized });
});

router.post('/:id/deny', (req, res) => {
  const { reason } = req.body;
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });
  if (booking.status !== 'Requested') return res.status(409).json({ error: 'This request has already been handled' });

  db.prepare("UPDATE bookings SET status = 'Denied', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  db.prepare('INSERT INTO workflow_notes (id, booking_id, stage, note) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, 'denied', reason || 'Request denied.');

  sendTemplateEmail('booking_request_denied', {
    booking_id: booking.id, client_id: booking.client_id, client_name: booking.client_name, client_email: booking.client_email,
    shoot_type: booking.shoot_type, shoot_date: booking.shoot_date,
    denial_reason: reason || ''
  }).catch(console.error);

  const denied = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json({ booking: denied });
});

module.exports = router;
