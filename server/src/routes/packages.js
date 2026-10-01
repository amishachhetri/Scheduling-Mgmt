const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { archived } = req.query;
  const rows = db.prepare(`
    SELECT * FROM packages WHERE archived = ? ORDER BY name ASC
  `).all(archived === 'true' ? 1 : 0);
  res.json(rows);
});

// extra_photo_price is deliberately nullable -- blank means "no extra-photo charge for this
// package" (the rule for weddings), distinct from 0 which would mean "extras are free but
// still tracked." An empty string/undefined from the form is normalized to null here.
function normalizePrice(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

router.post('/', (req, res) => {
  const { description, price, shoot_type, is_full_day, duration_minutes, included_photo_count, extra_photo_price } = req.body;
  const name = req.body.name?.trim();
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const parsedPrice = parseFloat(price);
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  const extraPrice = normalizePrice(extra_photo_price);
  if (extraPrice !== null && extraPrice < 0) return res.status(400).json({ error: 'extra_photo_price must be a non-negative number' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO packages (id, name, description, price, shoot_type, is_full_day, duration_minutes, included_photo_count, extra_photo_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description, parsedPrice, shoot_type, is_full_day ? 1 : 0, duration_minutes || 120, included_photo_count || 0, extraPrice);
  res.json(db.prepare('SELECT * FROM packages WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { description, price, shoot_type, archived, is_full_day, duration_minutes, included_photo_count, extra_photo_price } = req.body;
  const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
  if (!name) return res.status(400).json({ error: 'name cannot be blank' });

  const parsedPrice = price !== undefined ? parseFloat(price) : existing.price;
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  const extraPrice = extra_photo_price !== undefined ? normalizePrice(extra_photo_price) : existing.extra_photo_price;
  if (extraPrice !== null && extraPrice < 0) return res.status(400).json({ error: 'extra_photo_price must be a non-negative number' });

  db.prepare(`
    UPDATE packages SET name = ?, description = ?, price = ?, shoot_type = ?, archived = ?, is_full_day = ?, duration_minutes = ?,
      included_photo_count = ?, extra_photo_price = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name, description ?? existing.description, parsedPrice, shoot_type ?? existing.shoot_type,
    archived !== undefined ? (archived ? 1 : 0) : existing.archived,
    is_full_day !== undefined ? (is_full_day ? 1 : 0) : existing.is_full_day,
    duration_minutes ?? existing.duration_minutes,
    included_photo_count ?? existing.included_photo_count, extraPrice, req.params.id
  );
  res.json(db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
