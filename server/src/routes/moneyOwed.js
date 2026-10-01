const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { paid } = req.query;
  const isPaid = paid === 'true' ? 1 : 0;
  // Unpaid list only surfaces balances for shoots that have already happened (or manual
  // entries, which aren't tied to a shoot date) -- a balance on a future shoot isn't
  // "owed" yet. The paid/history list is unaffected.
  const dateFilter = isPaid === 0 ? "AND (m.booking_id IS NULL OR b.shoot_date < date('now'))" : '';
  const rows = db.prepare(`
    SELECT m.*,
      b.shoot_type, b.shoot_date
    FROM money_owed m
    LEFT JOIN bookings b ON m.booking_id = b.id
    WHERE m.paid = ? ${dateFilter}
    ORDER BY m.due_date ASC, m.created_at ASC
  `).all(isPaid);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, amount, due_date, notes } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'name and amount required' });
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });
  const id = uuidv4();
  db.prepare('INSERT INTO money_owed (id, name, amount, due_date, notes, type) VALUES (?, ?, ?, ?, ?, \'manual\')').run(id, name, parsedAmount, due_date, notes);
  res.json(db.prepare('SELECT * FROM money_owed WHERE id = ?').get(id));
});

// Editing is only for manual entries -- a booking-linked entry is derived from that booking's
// own balance_due and should only ever change by editing the booking itself, not here.
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM money_owed WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.type !== 'manual') return res.status(400).json({ error: 'This entry is tied to a booking and can only be edited from the booking itself.' });

  const { name, amount, due_date, notes } = req.body;
  if (!name || amount === undefined) return res.status(400).json({ error: 'name and amount required' });
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });

  db.prepare("UPDATE money_owed SET name = ?, amount = ?, due_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, parsedAmount, due_date || null, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM money_owed WHERE id = ?').get(req.params.id));
});

router.put('/:id/pay', (req, res) => {
  const existing = db.prepare('SELECT * FROM money_owed WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE money_owed SET paid = 1, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  if (existing.booking_id) {
    // Zero out balance_due so dashboard Total Owed decreases; mark deposit received
    db.prepare("UPDATE bookings SET balance_due = 0, deposit_received = 1, updated_at = datetime('now') WHERE id = ?").run(existing.booking_id);
  }
  res.json(db.prepare('SELECT * FROM money_owed WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM money_owed WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.type !== 'manual') return res.status(400).json({ error: 'This entry is tied to a booking and can only be removed from the booking itself.' });
  db.prepare('DELETE FROM money_owed WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
