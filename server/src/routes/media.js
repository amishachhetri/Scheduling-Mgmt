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

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM portfolio_media ORDER BY sort_order ASC, created_at DESC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { type, category, title, url, public_id, resource_type } = req.body;
  if (!url || !type || !category) return res.status(400).json({ error: 'type, category, and url are required' });

  const id = uuidv4();
  const thumbnail_url = type === 'video' && public_id ? cloudinary.videoThumbnailUrl(public_id) : null;
  const maxOrderRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM portfolio_media');

  await db.run(`
    INSERT INTO portfolio_media (id, type, category, title, url, thumbnail_url, public_id, resource_type, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, type, category, title || null, url, thumbnail_url, public_id || null, resource_type || 'image', maxOrderRow.m + 1]);

  res.json(await db.get('SELECT * FROM portfolio_media WHERE id = ?', [id]));
});

router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM portfolio_media WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { category, title, featured, sort_order } = req.body;
  await db.run(`
    UPDATE portfolio_media SET
      category = COALESCE(?, category),
      title = ?,
      featured = ?,
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `, [
    category ?? null, title !== undefined ? title : existing.title,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    sort_order !== undefined ? sort_order : null,
    req.params.id
  ]);

  res.json(await db.get('SELECT * FROM portfolio_media WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM portfolio_media WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  await db.run('DELETE FROM portfolio_media WHERE id = ?', [req.params.id]);

  if (existing.public_id && cloudinary.isConfigured()) {
    cloudinary.deleteAsset(existing.public_id, existing.resource_type || 'image').catch(console.error);
  }

  res.json({ success: true });
});

module.exports = router;
