const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const gcal = require('../services/googleCalendar');
const { adminAuth } = require('../middleware/adminAuth');

// Auth is applied per-route (not at the index.js app.use level) because this router shares
// the /api/calendar/* path prefix with the separately-mounted /api/calendar/google sub-router --
// mounting adminAuth at the prefix level would intercept those requests too.
router.get('/', adminAuth, async (req, res) => {
  const { start, end } = req.query;
  let bookingQ = "SELECT * FROM bookings WHERE status NOT IN ('Cancelled','Denied','Requested')";
  const params = [];
  if (start) { bookingQ += ' AND shoot_date >= ?'; params.push(start); }
  if (end) { bookingQ += ' AND shoot_date <= ?'; params.push(end); }

  const bookings = db.prepare(bookingQ).all(...params);

  // Overlap match (not just `date >= start`) so a multi-day block that started before this
  // range still shows up on the days of the range it covers.
  let blockedQ = 'SELECT * FROM blocked_dates WHERE 1=1';
  const bParams = [];
  if (end) { blockedQ += ' AND date <= ?'; bParams.push(end); }
  if (start) { blockedQ += ' AND COALESCE(end_date, date) >= ?'; bParams.push(start); }
  const blockedRows = db.prepare(blockedQ).all(...bParams);

  // Expand each row into one calendar entry per day it covers, clipped to [start, end].
  const blocked = [];
  for (const b of blockedRows) {
    if (!b.end_date || b.end_date === b.date) { blocked.push(b); continue; }
    let d = new Date(b.date + 'T00:00:00');
    const rangeEnd = new Date(b.end_date + 'T00:00:00');
    while (d <= rangeEnd) {
      const iso = d.toISOString().split('T')[0];
      if ((!start || iso >= start) && (!end || iso <= end)) blocked.push({ ...b, date: iso });
      d.setDate(d.getDate() + 1);
    }
  }

  // Also fetch individual booking_events (for multi-day weddings) in this range
  const multiDayEventsQ = start && end
    ? `SELECT be.*, b.client_name, b.id as booking_id, b.status, b.workflow_stage
       FROM booking_events be JOIN bookings b ON be.booking_id = b.id
       WHERE b.status NOT IN ('Cancelled','Denied','Requested') AND be.event_date >= ? AND be.event_date <= ?`
    : `SELECT be.*, b.client_name, b.id as booking_id, b.status, b.workflow_stage
       FROM booking_events be JOIN bookings b ON be.booking_id = b.id WHERE b.status NOT IN ('Cancelled','Denied','Requested')`;
  const multiDayItems = start && end
    ? db.prepare(multiDayEventsQ).all(start, end)
    : db.prepare(multiDayEventsQ).all();

  const events = [
    ...bookings.map(b => ({
      id: b.id,
      type: 'booking',
      title: `${b.client_name} - ${b.shoot_type}`,
      date: b.shoot_date,
      time: b.shoot_time,
      color: getStatusColor(b.status, b.workflow_stage),
      data: b
    })),
    // Individual events for multi-day weddings (show on their own dates)
    ...multiDayItems.map(ev => ({
      id: ev.id,
      type: 'booking',
      title: `${ev.client_name} - ${ev.event_name}`,
      date: ev.event_date,
      time: ev.event_time,
      color: getStatusColor(ev.status, ev.workflow_stage),
      data: { ...ev, id: ev.booking_id }
    })),
    ...blocked.map(b => ({
      id: b.id,
      type: 'blocked',
      title: b.label || 'Blocked',
      date: b.date,
      end_date: b.end_date,
      time: b.start_time,
      end_time: b.end_time,
      all_day: b.all_day === 1,
      color: '#6b7280',
      data: b
    }))
  ];

  // Overlay Google Calendar external events (non-booking events = busy time)
  const externalEvents = await gcal.fetchExternalEvents(start || '', end || '').catch(() => []);
  // Filter out events we already created (they have our booking prefix)
  const filtered = externalEvents.filter(e => !e.title.startsWith('📷'));
  events.push(...filtered);

  res.json(events);
});

function getStatusColor(status, stage) {
  if (status === 'Completed') return '#22c55e';
  if (status === 'Cancelled') return '#ef4444';
  if (stage === 'Shoot scheduled') return '#3b82f6';
  if (stage === 'Editing in progress' || stage === 'Editing complete') return '#f59e0b';
  if (stage === 'Final products delivered' || stage === 'Project closed') return '#22c55e';
  return '#8b5cf6';
}

module.exports = router;
