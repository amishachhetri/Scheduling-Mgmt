const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM blocked_dates ORDER BY date ASC').all());
});

router.post('/', (req, res) => {
  const { date, end_date, label, all_day, start_time, end_time } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO blocked_dates (id, date, end_date, label, all_day, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, date, end_date, label || 'Blocked', all_day !== false ? 1 : 0, start_time, end_time);
  res.json(db.prepare('SELECT * FROM blocked_dates WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM blocked_dates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
