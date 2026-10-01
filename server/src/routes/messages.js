const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { sendTemplateEmail, renderTemplate } = require('../services/email');

router.get('/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM message_templates ORDER BY type ASC').all());
});

router.put('/templates/:id', (req, res) => {
  const { subject, body, enabled, timing_days, timing_direction } = req.body;
  db.prepare(`
    UPDATE message_templates SET subject = ?, body = ?, enabled = ?, timing_days = ?, timing_direction = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(subject, body, enabled ? 1 : 0, timing_days, timing_direction, req.params.id);
  res.json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id));
});

router.post('/send/:bookingId', (req, res) => {
  const { template_type } = req.body;
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  sendTemplateEmail(template_type, {
    booking_id: booking.id,
    client_id: booking.client_id,
    client_name: booking.client_name,
    client_email: booking.client_email,
    shoot_type: booking.shoot_type,
    shoot_date: booking.shoot_date,
    shoot_time: booking.shoot_time,
    location: booking.location,
    balance_due: booking.balance_due,
    gallery_link: booking.gallery_link
  }).then(result => res.json(result)).catch(err => res.status(500).json({ error: err.message }));
});

router.get('/log', (req, res) => {
  const { client_id, booking_id } = req.query;
  let q = 'SELECT * FROM message_log WHERE 1=1';
  const params = [];
  if (client_id) { q += ' AND client_id = ?'; params.push(client_id); }
  if (booking_id) { q += ' AND booking_id = ?'; params.push(booking_id); }
  q += ' ORDER BY sent_at DESC';
  res.json(db.prepare(q).all(...params));
});

module.exports = router;
