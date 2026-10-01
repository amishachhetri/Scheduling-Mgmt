const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT ss.*, b.client_name, b.shoot_date, b.shoot_type
    FROM second_shooters ss
    JOIN bookings b ON ss.booking_id = b.id
    ORDER BY b.shoot_date DESC
  `).all();
  res.json(rows);
});

router.put('/:id/pay', (req, res) => {
  const existing = db.prepare('SELECT id FROM second_shooters WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE second_shooters SET paid = 1, paid_at = datetime(\'now\') WHERE id = ?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM second_shooters WHERE id = ?').get(req.params.id));
});

module.exports = router;
