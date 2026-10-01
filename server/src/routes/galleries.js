const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../services/cloudinary');

async function withExtras(gallery) {
  const photos = await db.all('SELECT * FROM gallery_photos WHERE gallery_id = ? ORDER BY sort_order ASC, created_at ASC', [gallery.id]);
  const favoritedCount = photos.filter(p => p.favorited).length;
  // extra_photo_price of null means "this package doesn't charge for extra picks" (weddings) --
  // keep extra_photo_count at 0 in that case so the UI doesn't show an "extra photos" charge
  // that isn't actually going to be billed.
  const chargesApply = gallery.extra_photo_price != null;
  const extraCount = chargesApply ? Math.max(0, favoritedCount - (gallery.included_photo_count || 0)) : 0;
  return {
    ...gallery,
    photos,
    favorited_count: favoritedCount,
    extra_photo_count: extraCount,
    extra_photo_cost: extraCount * (gallery.extra_photo_price || 0),
  };
}

router.get('/', async (req, res) => {
  const { booking_id, type } = req.query;
  let q = 'SELECT * FROM galleries WHERE 1=1';
  const params = [];
  if (booking_id) { q += ' AND booking_id = ?'; params.push(booking_id); }
  if (type) { q += ' AND type = ?'; params.push(type); }
  q += ' ORDER BY created_at DESC';
  const rows = await db.all(q, params);
  res.json(await Promise.all(rows.map(withExtras)));
});

router.get('/:id', async (req, res) => {
  const gallery = await db.get('SELECT * FROM galleries WHERE id = ?', [req.params.id]);
  if (!gallery) return res.status(404).json({ error: 'Not found' });
  res.json(await withExtras(gallery));
});

router.post('/', async (req, res) => {
  const { booking_id, title, type } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id required' });
  const galleryType = type === 'final' ? 'final' : 'proofing';

  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [booking_id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Included-photo count / extra-photo pricing only apply to proofing galleries -- a final
  // gallery has nothing left to "pick," so those stay at 0/null.
  // Price comes from the package itself if set there; a package that's never had a price set
  // falls back to the studio-wide default -- UNLESS it's a full-day (wedding) package, which
  // never charges for extra picks regardless of any default.
  let includedCount = 0;
  let extraPrice = null;
  if (galleryType === 'proofing') {
    const pkg = booking.package_id
      ? await db.get('SELECT included_photo_count, extra_photo_price, is_full_day FROM packages WHERE id = ?', [booking.package_id])
      : null;
    includedCount = pkg?.included_photo_count || 0;
    if (pkg?.extra_photo_price != null) {
      extraPrice = pkg.extra_photo_price;
    } else if (!pkg?.is_full_day) {
      const profile = await db.get('SELECT default_extra_photo_price FROM photographer_profile WHERE id = 1');
      extraPrice = profile?.default_extra_photo_price ?? 15;
    }
  }

  const id = uuidv4();
  const accessToken = crypto.randomBytes(20).toString('hex');
  const defaultTitle = `${booking.client_name} — ${booking.shoot_type}${galleryType === 'final' ? ' (Final)' : ''}`;
  await db.run(`
    INSERT INTO galleries (id, booking_id, type, title, included_photo_count, extra_photo_price, access_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, booking_id, galleryType, title || defaultTitle, includedCount, extraPrice, accessToken]);

  res.json(await withExtras(await db.get('SELECT * FROM galleries WHERE id = ?', [id])));
});

router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM galleries WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // Distinguish "field omitted" (keep existing) from "field explicitly null" (clear it) --
  // COALESCE can't tell those apart, but an explicit null is exactly how "no extra-photo
  // charge for this gallery" gets set, so it has to actually take effect.
  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const includedCount = req.body.included_photo_count !== undefined ? req.body.included_photo_count : existing.included_photo_count;
  const extraPrice = req.body.extra_photo_price !== undefined ? req.body.extra_photo_price : existing.extra_photo_price;
  const status = req.body.status !== undefined ? req.body.status : existing.status;

  await db.run(`
    UPDATE galleries SET title = ?, included_photo_count = ?, extra_photo_price = ?, status = ?, updated_at = ${NOW_TS}
    WHERE id = ?
  `, [title, includedCount, extraPrice, status, req.params.id]);

  res.json(await withExtras(await db.get('SELECT * FROM galleries WHERE id = ?', [req.params.id])));
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM galleries WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const photos = await db.all('SELECT * FROM gallery_photos WHERE gallery_id = ?', [req.params.id]);
  await db.run('DELETE FROM gallery_photos WHERE gallery_id = ?', [req.params.id]);
  await db.run('DELETE FROM galleries WHERE id = ?', [req.params.id]);

  if (cloudinary.isConfigured()) {
    for (const p of photos) {
      if (p.public_id) cloudinary.deleteAsset(p.public_id, p.resource_type || 'image').catch(console.error);
    }
  }

  res.json({ success: true });
});

// GET /api/galleries/:id/sign — signed Cloudinary upload scoped to this gallery's own folder.
router.get('/:id/sign', async (req, res) => {
  if (!cloudinary.isConfigured()) return res.status(400).json({ error: 'Cloudinary is not configured yet.' });
  const gallery = await db.get('SELECT id FROM galleries WHERE id = ?', [req.params.id]);
  if (!gallery) return res.status(404).json({ error: 'Not found' });
  res.json(cloudinary.signUpload({ folder: `galleries/${gallery.id}` }));
});

router.post('/:id/photos', async (req, res) => {
  const gallery = await db.get('SELECT id FROM galleries WHERE id = ?', [req.params.id]);
  if (!gallery) return res.status(404).json({ error: 'Not found' });

  const { url, public_id, resource_type } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const id = uuidv4();
  const maxOrderRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gallery_photos WHERE gallery_id = ?', [req.params.id]);
  await db.run(`
    INSERT INTO gallery_photos (id, gallery_id, url, public_id, resource_type, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, req.params.id, url, public_id || null, resource_type || 'image', maxOrderRow.m + 1]);

  res.json(await db.get('SELECT * FROM gallery_photos WHERE id = ?', [id]));
});

router.delete('/:id/photos/:photoId', async (req, res) => {
  const photo = await db.get('SELECT * FROM gallery_photos WHERE id = ? AND gallery_id = ?', [req.params.photoId, req.params.id]);
  if (!photo) return res.status(404).json({ error: 'Not found' });

  await db.run('DELETE FROM gallery_photos WHERE id = ?', [req.params.photoId]);
  if (photo.public_id && cloudinary.isConfigured()) {
    cloudinary.deleteAsset(photo.public_id, photo.resource_type || 'image').catch(console.error);
  }
  res.json({ success: true });
});

module.exports = router;
