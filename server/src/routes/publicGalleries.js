const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { db } = require('../db/schema');

const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const toggleLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
router.use(readLimiter);

// GET /api/public/galleries/:token — client-facing view: only what's needed to browse and
// heart photos, never booking internals (client email/phone/notes/balance).
router.get('/:token', (req, res) => {
  const gallery = db.prepare('SELECT * FROM galleries WHERE access_token = ?').get(req.params.token);
  if (!gallery) return res.status(404).json({ error: 'Gallery not found' });

  const booking = db.prepare('SELECT client_name, shoot_type, shoot_date FROM bookings WHERE id = ?').get(gallery.booking_id);
  const photos = db.prepare('SELECT id, url, thumbnail_url, favorited FROM gallery_photos WHERE gallery_id = ? ORDER BY sort_order ASC, created_at ASC').all(gallery.id);
  const favoritedCount = photos.filter(p => p.favorited).length;

  res.json({
    id: gallery.id,
    type: gallery.type,
    title: gallery.title,
    status: gallery.status,
    client_name: booking?.client_name,
    shoot_type: booking?.shoot_type,
    shoot_date: booking?.shoot_date,
    included_photo_count: gallery.included_photo_count,
    extra_photo_price: gallery.extra_photo_price,
    favorited_count: favoritedCount,
    photos: photos.map(p => ({ ...p, favorited: !!p.favorited })),
  });
});

// PUT /api/public/galleries/:token/photos/:photoId — toggle a favorite. Only on proofing
// galleries (a final gallery has nothing left to pick), and only while the photographer still
// has the gallery open for picks (closes once they move on to editing).
router.put('/:token/photos/:photoId', toggleLimiter, (req, res) => {
  const gallery = db.prepare('SELECT * FROM galleries WHERE access_token = ?').get(req.params.token);
  if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
  if (gallery.type !== 'proofing') return res.status(400).json({ error: 'Favoriting is not available on this gallery.' });
  if (gallery.status !== 'open') return res.status(409).json({ error: 'This gallery is no longer open for picks.' });

  const photo = db.prepare('SELECT * FROM gallery_photos WHERE id = ? AND gallery_id = ?').get(req.params.photoId, gallery.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const { favorited } = req.body;
  db.prepare('UPDATE gallery_photos SET favorited = ? WHERE id = ?').run(favorited ? 1 : 0, photo.id);
  res.json({ id: photo.id, favorited: !!favorited });
});

module.exports = router;
