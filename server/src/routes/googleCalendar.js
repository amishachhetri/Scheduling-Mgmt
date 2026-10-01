const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const gcal = require('../services/googleCalendar');
const { adminAuth } = require('../middleware/adminAuth');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// GET /api/calendar/google/status
router.get('/status', adminAuth, (req, res) => {
  const p = gcal.getProfile();
  res.json({
    connected: gcal.isConnected(),
    has_credentials: !!(p?.google_oauth_client_id && p?.google_oauth_client_secret),
    last_synced: p?.google_last_synced || null,
    calendar_id: p?.google_calendar_id || 'primary',
  });
});

// POST /api/calendar/google/credentials  — save client ID + secret
router.post('/credentials', adminAuth, (req, res) => {
  const { client_id, client_secret, calendar_id } = req.body;
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  db.prepare("UPDATE photographer_profile SET google_oauth_client_id = ?, google_oauth_client_secret = ?, google_calendar_id = ? WHERE id = 1")
    .run(client_id, client_secret, calendar_id || 'primary');
  res.json({ ok: true });
});

// GET /api/calendar/google/auth  — start OAuth flow
router.get('/auth', adminAuth, (req, res) => {
  const p = gcal.getProfile();
  if (!p?.google_oauth_client_id || !p?.google_oauth_client_secret) {
    return res.status(400).json({ error: 'No OAuth credentials configured. Enter them in Settings first.' });
  }
  const url = gcal.getAuthUrl(p.google_oauth_client_id, p.google_oauth_client_secret);
  res.redirect(url);
});

// GET /api/calendar/google/callback  — OAuth redirect from Google.
// Deliberately NOT behind adminAuth: this is a top-level cross-site redirect from
// accounts.google.com, and while a SameSite=Lax cookie should survive that, it's untested
// here -- excluding it avoids a broken OAuth flow if it doesn't. Low added risk: the request
// is already gated by Google's own `code`, which only this server's client secret can exchange.
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/admin/settings?tab=calendar&error=` + (error || 'no_code'));
  }
  try {
    await gcal.exchangeCode(code);
    res.redirect(`${CLIENT_URL}/admin/settings?tab=calendar&connected=true`);
  } catch (e) {
    res.redirect(`${CLIENT_URL}/admin/settings?tab=calendar&error=token_exchange_failed`);
  }
});

// POST /api/calendar/google/sync  — manual full sync
router.post('/sync', adminAuth, async (req, res) => {
  try {
    const result = await gcal.syncAll();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/calendar/google/disconnect
router.delete('/disconnect', adminAuth, (req, res) => {
  db.prepare("UPDATE photographer_profile SET google_oauth_refresh_token = NULL, google_last_synced = NULL WHERE id = 1").run();
  res.json({ ok: true });
});

module.exports = router;
