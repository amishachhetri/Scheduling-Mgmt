const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { adminAuth } = require('../middleware/adminAuth');

function icsDate(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = dateStr.replace(/-/g, '');
  if (!timeStr) return `${d}`;
  const t = timeStr.replace(/:/g, '').slice(0, 4) + '00';
  return `${d}T${t}`;
}

function escapeICS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function bookingToVEVENT(b) {
  const uid = `booking-${b.id}@photographer-app`;
  const dtStart = icsDate(b.shoot_date, b.shoot_time);
  const dtEnd   = icsDate(b.shoot_date, b.shoot_end_time || b.shoot_time);
  const desc = [
    b.package_name ? `Package: ${b.package_name}` : '',
    `Balance due: $${b.balance_due || 0}`,
    b.notes ? `Notes: ${b.notes}` : '',
  ].filter(Boolean).join('\\n');

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date().toISOString().split('T')[0], new Date().toTimeString().slice(0,5))}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(`${b.client_name} — ${b.shoot_type}`)}`,
    `DESCRIPTION:${desc}`,
    b.location ? `LOCATION:${escapeICS(b.location)}` : '',
    `STATUS:${b.status === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

function wrapICS(vevents) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Photographer App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Photography Shoots',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

// GET /api/ics?token=...  — full calendar (for subscription). Deliberately unauthenticated
// (calendar apps can't send a login session) but gated on a private per-photographer token so
// the URL isn't a plain, guessable window into every client's name/notes/balance due.
router.get('/', async (req, res) => {
  const profile = await db.get('SELECT ics_feed_token FROM photographer_profile WHERE id = 1');
  if (!profile?.ics_feed_token || req.query.token !== profile.ics_feed_token) {
    return res.status(401).json({ error: 'Invalid or missing calendar feed token' });
  }
  const bookings = await db.all("SELECT * FROM bookings WHERE status NOT IN ('Denied','Requested') AND deleted_at IS NULL ORDER BY shoot_date ASC");
  const ics = wrapICS(bookings.map(bookingToVEVENT));
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="shoots.ics"');
  res.send(ics);
});

// GET /api/ics/:id  — single booking download. Only ever linked from the authenticated admin
// booking detail page, so (unlike the feed above) it's gated on the normal admin session.
router.get('/:id', adminAuth, async (req, res) => {
  const b = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const ics = wrapICS([bookingToVEVENT(b)]);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${b.client_name.replace(/[^a-z0-9]/gi,'_')}-shoot.ics"`);
  res.send(ics);
});

module.exports = router;
