const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, b.client_name, b.shoot_date, b.shoot_type
    FROM reminders r
    LEFT JOIN bookings b ON r.booking_id = b.id
    WHERE r.dismissed = 0
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows);
});

router.put('/:id/dismiss', (req, res) => {
  const existing = db.prepare('SELECT id FROM reminders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE reminders SET dismissed = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/dismiss-all', (req, res) => {
  db.prepare('UPDATE reminders SET dismissed = 1 WHERE dismissed = 0').run();
  res.json({ success: true });
});

module.exports = router;
