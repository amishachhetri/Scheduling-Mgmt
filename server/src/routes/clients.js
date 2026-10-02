const express = require('express');
const router = express.Router();
const { db, NOW_TS, NOW_DATE } = require('../db/schema');

router.get('/', async (req, res) => {
  const { search, shoot_type, status } = req.query;
  let query = `
    SELECT c.*,
      (SELECT COUNT(*)::int FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) as total_shoots,
      (SELECT COALESCE(SUM(b.deposit_amount), 0) FROM bookings b WHERE b.client_id = c.id AND b.deposit_received = 1 AND b.deleted_at IS NULL) as total_spent,
      (SELECT COALESCE(SUM(b.balance_due), 0) FROM bookings b WHERE b.client_id = c.id AND b.status != 'Completed' AND b.shoot_date < ${NOW_DATE} AND b.deleted_at IS NULL) as outstanding_balance,
      (SELECT b.workflow_stage FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL ORDER BY b.shoot_date DESC LIMIT 1) as current_stage,
      (SELECT b.shoot_type FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL ORDER BY b.shoot_date DESC LIMIT 1) as last_shoot_type,
      (SELECT b.status FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL ORDER BY b.shoot_date DESC LIMIT 1) as last_status,
      (SELECT MAX(m.sent_at) FROM message_log m WHERE m.client_id = c.id) as last_message_sent,
      (SELECT b.gallery_link FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL ORDER BY b.shoot_date DESC LIMIT 1) as gallery_link
    FROM clients c
    WHERE c.deleted_at IS NULL
  `;
  const params = [];
  if (search) {
    // Escape LIKE's own wildcards in the user's search text so a literal "%" or "_" in a name
    // doesn't act as a pattern -- ESCAPE '\' makes '\' the escape character for this query.
    const likeSafe = search.replace(/[\\%_]/g, m => '\\' + m);
    query += ` AND (c.name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\')`;
    params.push(`%${likeSafe}%`, `%${likeSafe}%`, `%${likeSafe}%`);
  }
  if (shoot_type) { query += ` AND (SELECT b.shoot_type FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL ORDER BY b.shoot_date DESC LIMIT 1) = ?`; params.push(shoot_type); }
  query += ` ORDER BY c.name ASC`;
  res.json(await db.all(query, params));
});

// Must come before GET /:id -- otherwise Express matches "trash" as an :id instead.
router.get('/trash', async (req, res) => {
  const rows = await db.all('SELECT * FROM clients WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
  res.json(rows);
});

router.post('/:id/restore', async (req, res) => {
  const client = await db.get('SELECT * FROM clients WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
  if (!client) return res.status(404).json({ error: 'Not in trash' });
  await db.run(`UPDATE clients SET deleted_at = NULL, updated_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  res.json(await db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
});

router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  await db.run(`UPDATE clients SET name = ?, email = ?, phone = ?, updated_at = ${NOW_TS} WHERE id = ?`,
    [name, email ?? existing.email, phone ?? existing.phone, req.params.id]);
  res.json(await db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
});

// Only removable once it has no active shoot history -- a client with real bookings should be
// deleted by removing those bookings first, not silently along with them. Soft-deleted into
// Trash (see GET /trash, POST /:id/restore); a daily job permanently purges it after 24h.
router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const bookingCount = await db.get('SELECT COUNT(*)::int as count FROM bookings WHERE client_id = ? AND deleted_at IS NULL', [req.params.id]);
  if (bookingCount.count > 0) {
    return res.status(400).json({ error: 'This client still has bookings. Delete those first.' });
  }
  await db.run(`UPDATE clients SET deleted_at = ${NOW_TS} WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

router.get('/:id', async (req, res) => {
  const client = await db.get('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  if (!client) return res.status(404).json({ error: 'Not found' });
  client.bookings = await db.all('SELECT * FROM bookings WHERE client_id = ? AND deleted_at IS NULL ORDER BY shoot_date DESC', [req.params.id]);
  client.messages = await db.all('SELECT * FROM message_log WHERE client_id = ? ORDER BY sent_at DESC', [req.params.id]);
  // Computed live, same as the list endpoint -- the stored clients.total_spent column is only
  // ever incremented on workflow -> "Project closed" and drifts from reality on any other path.
  const spent = await db.get(
    `SELECT COALESCE(SUM(deposit_amount), 0) as total FROM bookings WHERE client_id = ? AND deposit_received = 1 AND deleted_at IS NULL`, [req.params.id]
  );
  client.total_spent = spent.total;
  res.json(client);
});

module.exports = router;
