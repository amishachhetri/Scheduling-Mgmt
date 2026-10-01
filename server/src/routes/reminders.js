const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');

router.get('/', async (req, res) => {
  const rows = await db.all(`
    SELECT r.*, b.client_name, b.shoot_date, b.shoot_type
    FROM reminders r
    LEFT JOIN bookings b ON r.booking_id = b.id
    WHERE r.dismissed = 0
    ORDER BY r.created_at DESC
  `);
  res.json(rows);
});

router.put('/:id/dismiss', async (req, res) => {
  const existing = await db.get('SELECT id FROM reminders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.run('UPDATE reminders SET dismissed = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.put('/dismiss-all', async (req, res) => {
  await db.run('UPDATE reminders SET dismissed = 1 WHERE dismissed = 0');
  res.json({ success: true });
});

module.exports = router;
