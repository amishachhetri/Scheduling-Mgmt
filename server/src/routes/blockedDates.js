const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  res.json(await db.all('SELECT * FROM blocked_dates ORDER BY date ASC'));
});

router.post('/', async (req, res) => {
  const { date, end_date, label, all_day, start_time, end_time } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const id = uuidv4();
  await db.run(`
    INSERT INTO blocked_dates (id, date, end_date, label, all_day, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, date, end_date, label || 'Blocked', all_day !== false ? 1 : 0, start_time, end_time]);
  res.json(await db.get('SELECT * FROM blocked_dates WHERE id = ?', [id]));
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT id FROM blocked_dates WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.run('DELETE FROM blocked_dates WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
