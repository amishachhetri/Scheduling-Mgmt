const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, NOW_TS } = require('../db/schema');

function maskSecrets(profile) {
  if (!profile) return profile;
  profile.smtp_pass = profile.smtp_pass ? '****' : '';
  profile.twilio_auth_token = profile.twilio_auth_token ? '****' : '';
  // These two aren't editable through this route (only via /calendar/google/credentials) and
  // the client never reads them back, but GET /profile was still handing the raw values to
  // any admin-authenticated caller -- same exposure class as the two above, just unmasked.
  profile.google_oauth_client_secret = profile.google_oauth_client_secret ? '****' : null;
  profile.google_oauth_refresh_token = profile.google_oauth_refresh_token ? '****' : null;
  return profile;
}

router.get('/', async (req, res) => {
  const profile = await db.get('SELECT * FROM photographer_profile WHERE id = 1');
  res.json(maskSecrets(profile));
});

router.put('/', async (req, res) => {
  const {
    name, email, phone, business_name,
    smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
    buffer_hours,
    twilio_account_sid, twilio_auth_token, twilio_from_number,
    bio, avatar_url, cover_photo_url, instagram_url, default_extra_photo_price
  } = req.body;

  const existing = await db.get('SELECT smtp_pass, twilio_auth_token FROM photographer_profile WHERE id = 1');
  const finalPass = smtp_pass === '****' ? existing?.smtp_pass : smtp_pass;
  const finalTwilioToken = twilio_auth_token === '****' ? existing?.twilio_auth_token : twilio_auth_token;

  await db.run(`
    UPDATE photographer_profile SET
      name = ?, email = ?, phone = ?, business_name = ?,
      smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, smtp_from = ?,
      buffer_hours = ?,
      twilio_account_sid = ?, twilio_auth_token = ?, twilio_from_number = ?,
      bio = ?, avatar_url = ?, cover_photo_url = ?, instagram_url = ?,
      default_extra_photo_price = ?,
      updated_at = ${NOW_TS}
    WHERE id = 1
  `, [
    name, email, phone, business_name, smtp_host, smtp_port, smtp_user, finalPass, smtp_from, buffer_hours,
    twilio_account_sid || null, finalTwilioToken || null, twilio_from_number || null,
    bio || null, avatar_url || null, cover_photo_url || null, instagram_url || null,
    default_extra_photo_price ?? 15
  ]);

  const updated = await db.get('SELECT * FROM photographer_profile WHERE id = 1');
  res.json(maskSecrets(updated));
});

// POST /api/profile/regenerate-ics-token — invalidates the current calendar feed link (e.g. if
// it leaked) and issues a new one. Existing subscriptions in Apple Calendar/Outlook will need
// to be re-added with the new URL.
router.post('/regenerate-ics-token', async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  await db.run('UPDATE photographer_profile SET ics_feed_token = ? WHERE id = 1', [token]);
  res.json({ ics_feed_token: token });
});

module.exports = router;
