const { google } = require('googleapis');
const { db } = require('../db/schema');

const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5001/api/calendar/google/callback';
// No per-photographer timezone setting exists yet, so this defaults to wherever the server
// process itself runs -- correct for typical same-region hosting, override via env if the
// server and photographer are ever in different zones.
const CALENDAR_TIMEZONE = process.env.GCAL_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

function getProfile() {
  return db.prepare('SELECT * FROM photographer_profile WHERE id = 1').get();
}

function getOAuth2Client(profile) {
  if (!profile) profile = getProfile();
  if (!profile?.google_oauth_client_id || !profile?.google_oauth_client_secret) return null;
  const client = new google.auth.OAuth2(
    profile.google_oauth_client_id,
    profile.google_oauth_client_secret,
    REDIRECT_URI
  );
  if (profile.google_oauth_refresh_token) {
    client.setCredentials({ refresh_token: profile.google_oauth_refresh_token });
  }
  return client;
}

function isConnected() {
  const p = getProfile();
  return !!(p?.google_oauth_client_id && p?.google_oauth_client_secret && p?.google_oauth_refresh_token);
}

function getAuthUrl(clientId, clientSecret) {
  const client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function exchangeCode(code) {
  const p = getProfile();
  const client = getOAuth2Client(p);
  if (!client) throw new Error('OAuth client not configured');
  const { tokens } = await client.getToken(code);
  db.prepare("UPDATE photographer_profile SET google_oauth_refresh_token = ?, google_last_synced = datetime('now') WHERE id = 1")
    .run(tokens.refresh_token || p.google_oauth_refresh_token);
  return tokens;
}

function bookingToGCalEvent(booking) {
  const startTime = booking.shoot_time?.length === 5 ? `${booking.shoot_time}:00` : booking.shoot_time;
  const rawEnd = booking.shoot_end_time;
  const endTime = rawEnd ? (rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd) : `${startTime.slice(0, 2) === '23' ? '23:59:00' : `${String(parseInt(startTime)+1).padStart(2,'0')}:00:00`}`;
  return {
    summary: `📷 ${booking.client_name} — ${booking.shoot_type}`,
    description: [
      booking.package_name ? `Package: ${booking.package_name}` : '',
      booking.location ? `Location: ${booking.location}` : '',
      booking.notes ? `Notes: ${booking.notes}` : '',
      `Balance due: $${booking.balance_due || 0}`,
    ].filter(Boolean).join('\n'),
    location: booking.location || '',
    start: { dateTime: `${booking.shoot_date}T${startTime}`, timeZone: CALENDAR_TIMEZONE },
    end:   { dateTime: `${booking.shoot_date}T${endTime}`,   timeZone: CALENDAR_TIMEZONE },
    colorId: booking.status === 'Cancelled' ? '11' : booking.status === 'Tentative' ? '5' : '7',
  };
}

async function createEvent(booking) {
  if (!isConnected()) return null;
  try {
    const p = getProfile();
    const auth = getOAuth2Client(p);
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.events.insert({
      calendarId: p.google_calendar_id || 'primary',
      resource: bookingToGCalEvent(booking),
    });
    db.prepare("UPDATE bookings SET google_calendar_event_id = ? WHERE id = ?").run(res.data.id, booking.id);
    return res.data.id;
  } catch (e) { console.error('[GCal] createEvent:', e.message); return null; }
}

async function updateEvent(booking) {
  if (!isConnected() || !booking.google_calendar_event_id) return;
  try {
    const p = getProfile();
    const auth = getOAuth2Client(p);
    const cal = google.calendar({ version: 'v3', auth });
    await cal.events.update({
      calendarId: p.google_calendar_id || 'primary',
      eventId: booking.google_calendar_event_id,
      resource: bookingToGCalEvent(booking),
    });
  } catch (e) { console.error('[GCal] updateEvent:', e.message); }
}

async function deleteEvent(booking) {
  if (!isConnected() || !booking.google_calendar_event_id) return;
  try {
    const p = getProfile();
    const auth = getOAuth2Client(p);
    const cal = google.calendar({ version: 'v3', auth });
    await cal.events.delete({
      calendarId: p.google_calendar_id || 'primary',
      eventId: booking.google_calendar_event_id,
    });
  } catch (e) { console.error('[GCal] deleteEvent:', e.message); }
}

async function syncAll() {
  if (!isConnected()) return { synced: 0 };
  const bookings = db.prepare("SELECT * FROM bookings WHERE status != 'Cancelled'").all();
  let synced = 0;
  for (const b of bookings) {
    if (b.google_calendar_event_id) {
      await updateEvent(b);
    } else {
      await createEvent(b);
    }
    synced++;
  }
  db.prepare("UPDATE photographer_profile SET google_last_synced = datetime('now') WHERE id = 1").run();
  return { synced };
}

// Fetch Google Calendar events to display as blocked time in the app
async function fetchExternalEvents(start, end) {
  if (!isConnected()) return [];
  try {
    const p = getProfile();
    const auth = getOAuth2Client(p);
    const cal = google.calendar({ version: 'v3', auth });
    const res = await cal.events.list({
      calendarId: p.google_calendar_id || 'primary',
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end + 'T23:59:59').toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });
    return (res.data.items || []).map(ev => ({
      id: 'gcal-' + ev.id,
      type: 'gcal',
      title: ev.summary || 'Google Calendar event',
      date: (ev.start.dateTime || ev.start.date || '').slice(0, 10),
      time: ev.start.dateTime ? ev.start.dateTime.slice(11, 16) : null,
      end_time: ev.end.dateTime ? ev.end.dateTime.slice(11, 16) : null,
      color: '#4285f4',
    }));
  } catch (e) { console.error('[GCal] fetchExternal:', e.message); return []; }
}

module.exports = { isConnected, getAuthUrl, exchangeCode, getProfile, createEvent, updateEvent, deleteEvent, syncAll, fetchExternalEvents };
