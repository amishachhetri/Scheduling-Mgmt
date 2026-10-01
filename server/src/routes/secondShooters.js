const express = require('express');
const router = express.Router();
const { db, NOW_TS } = require('../db/schema');

router.get('/', async (req, res) => {
  const rows = await db.all(`
    SELECT ss.*, b.client_name, b.shoot_date, b.shoot_type
    FROM second_shooters ss
    JOIN bookings b ON ss.booking_id = b.id
    ORDER BY b.shoot_date DESC
  `);
  res.json(rows);
});

router.put('/:id/pay', async (req, res) => {
  const existing = await db.get('SELECT id FROM second_shooters WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.run(`UPDATE second_shooters SET paid = 1, paid_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  res.json(await db.get('SELECT * FROM second_shooters WHERE id = ?', [req.params.id]));
});

module.exports = router;
