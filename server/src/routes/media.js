const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../services/cloudinary');

router.get('/config', (req, res) => {
  res.json({ configured: cloudinary.isConfigured() });
});

router.get('/sign', (req, res) => {
  if (!cloudinary.isConfigured()) return res.status(400).json({ error: 'Cloudinary is not configured yet.' });
  const folder = 'portfolio';
  res.json(cloudinary.signUpload({ folder }));
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM portfolio_media ORDER BY sort_order ASC, created_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { type, category, title, url, public_id, resource_type } = req.body;
  if (!url || !type || !category) return res.status(400).json({ error: 'type, category, and url are required' });

  const id = uuidv4();
  const thumbnail_url = type === 'video' && public_id ? cloudinary.videoThumbnailUrl(public_id) : null;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM portfolio_media').get().m;

  db.prepare(`
    INSERT INTO portfolio_media (id, type, category, title, url, thumbnail_url, public_id, resource_type, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, category, title || null, url, thumbnail_url, public_id || null, resource_type || 'image', maxOrder + 1);

  res.json(db.prepare('SELECT * FROM portfolio_media WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM portfolio_media WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { category, title, featured, sort_order } = req.body;
  db.prepare(`
    UPDATE portfolio_media SET
      category = COALESCE(?, category),
      title = ?,
      featured = ?,
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    category ?? null, title !== undefined ? title : existing.title,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    sort_order !== undefined ? sort_order : null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM portfolio_media WHERE id = ?').get(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM portfolio_media WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM portfolio_media WHERE id = ?').run(req.params.id);

  if (existing.public_id && cloudinary.isConfigured()) {
    cloudinary.deleteAsset(existing.public_id, existing.resource_type || 'image').catch(console.error);
  }

  res.json({ success: true });
});

module.exports = router;
