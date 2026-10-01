const express = require('express');
const router = express.Router();
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  const { paid } = req.query;
  const isPaid = paid === 'true' ? 1 : 0;
  // Unpaid list shows every outstanding balance, whether the shoot already happened or is
  // still upcoming -- a deposit/balance can be due well before the shoot date, so "not yet
  // paid" is the only thing that should gate this, not whether the shoot has occurred.
  const rows = await db.all(`
    SELECT m.*,
      b.shoot_type, b.shoot_date
    FROM money_owed m
    LEFT JOIN bookings b ON m.booking_id = b.id
    WHERE m.paid = ?
    ORDER BY m.due_date ASC, m.created_at ASC
  `, [isPaid]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, amount, due_date, notes } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'name and amount required' });
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });
  const id = uuidv4();
  await db.run("INSERT INTO money_owed (id, name, amount, due_date, notes, type) VALUES (?, ?, ?, ?, ?, 'manual')", [id, name, parsedAmount, due_date, notes]);
  res.json(await db.get('SELECT * FROM money_owed WHERE id = ?', [id]));
});

// Editing is only for manual entries -- a booking-linked entry is derived from that booking's
// own balance_due and should only ever change by editing the booking itself, not here.
router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM money_owed WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.type !== 'manual') return res.status(400).json({ error: 'This entry is tied to a booking and can only be edited from the booking itself.' });

  const { name, amount, due_date, notes } = req.body;
  if (!name || amount === undefined) return res.status(400).json({ error: 'name and amount required' });
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });

  await db.run(`UPDATE money_owed SET name = ?, amount = ?, due_date = ?, notes = ?, updated_at = ${NOW_TS} WHERE id = ?`,
    [name, parsedAmount, due_date || null, notes || null, req.params.id]);
  res.json(await db.get('SELECT * FROM money_owed WHERE id = ?', [req.params.id]));
});

router.put('/:id/pay', async (req, res) => {
  const existing = await db.get('SELECT * FROM money_owed WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.run(`UPDATE money_owed SET paid = 1, paid_at = ${NOW_TS}, updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  if (existing.booking_id) {
    // Zero out balance_due so dashboard Total Owed decreases; mark deposit received
    await db.run(`UPDATE bookings SET balance_due = 0, deposit_received = 1, updated_at = ${NOW_TS} WHERE id = ?`, [existing.booking_id]);
  }
  res.json(await db.get('SELECT * FROM money_owed WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM money_owed WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.type !== 'manual') return res.status(400).json({ error: 'This entry is tied to a booking and can only be removed from the booking itself.' });
  await db.run('DELETE FROM money_owed WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
