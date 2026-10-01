const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');

router.get('/', (req, res) => {
  const { search, shoot_type, status } = req.query;
  let query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id) as total_shoots,
      (SELECT COALESCE(SUM(b.deposit_amount), 0) FROM bookings b WHERE b.client_id = c.id AND b.deposit_received = 1) as total_spent,
      (SELECT COALESCE(SUM(b.balance_due), 0) FROM bookings b WHERE b.client_id = c.id AND b.status != 'Completed' AND b.shoot_date < date('now')) as outstanding_balance,
      (SELECT b.workflow_stage FROM bookings b WHERE b.client_id = c.id ORDER BY b.shoot_date DESC LIMIT 1) as current_stage,
      (SELECT b.shoot_type FROM bookings b WHERE b.client_id = c.id ORDER BY b.shoot_date DESC LIMIT 1) as last_shoot_type,
      (SELECT b.status FROM bookings b WHERE b.client_id = c.id ORDER BY b.shoot_date DESC LIMIT 1) as last_status,
      (SELECT MAX(m.sent_at) FROM message_log m WHERE m.client_id = c.id) as last_message_sent,
      (SELECT b.gallery_link FROM bookings b WHERE b.client_id = c.id ORDER BY b.shoot_date DESC LIMIT 1) as gallery_link
    FROM clients c
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    // Escape LIKE's own wildcards in the user's search text so a literal "%" or "_" in a name
    // doesn't act as a pattern -- ESCAPE '\' makes '\' the escape character for this query.
    const likeSafe = search.replace(/[\\%_]/g, m => '\\' + m);
    query += ` AND (c.name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\')`;
    params.push(`%${likeSafe}%`, `%${likeSafe}%`, `%${likeSafe}%`);
  }
  if (shoot_type) { query += ` AND (SELECT b.shoot_type FROM bookings b WHERE b.client_id = c.id ORDER BY b.shoot_date DESC LIMIT 1) = ?`; params.push(shoot_type); }
  query += ` ORDER BY c.name ASC`;
  res.json(db.prepare(query).all(...params));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare("UPDATE clients SET name = ?, email = ?, phone = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, email ?? existing.email, phone ?? existing.phone, req.params.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  client.bookings = db.prepare('SELECT * FROM bookings WHERE client_id = ? ORDER BY shoot_date DESC').all(req.params.id);
  client.messages = db.prepare('SELECT * FROM message_log WHERE client_id = ? ORDER BY sent_at DESC').all(req.params.id);
  // Computed live, same as the list endpoint -- the stored clients.total_spent column is only
  // ever incremented on workflow -> "Project closed" and drifts from reality on any other path.
  client.total_spent = db.prepare(
    `SELECT COALESCE(SUM(deposit_amount), 0) as total FROM bookings WHERE client_id = ? AND deposit_received = 1`
  ).get(req.params.id).total;
  res.json(client);
});

module.exports = router;
