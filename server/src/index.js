require('dotenv').config();
// Patches Express so a rejected promise/thrown error inside an `async (req, res) => {}` handler
// is forwarded to the error-handling middleware below automatically, the same way a thrown
// error from a synchronous handler already was -- without this, every one of the now-async
// route handlers would just hang the request on failure instead of returning an error.
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDB } = require('./db/schema');
const { adminAuth } = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Runs once per process (held in this closure across every request/cold start after the
// first); every request waits for it so nothing can query tables that don't exist yet.
const dbReady = initDB().catch(err => {
  console.error('Database initialization failed:', err);
  throw err;
});
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch {
    res.status(503).json({ error: 'Database is not available right now.' });
  }
});

// Public routes — no auth, rate-limited internally
app.use('/api/public', require('./routes/public'));
app.use('/api/public/galleries', require('./routes/publicGalleries'));

// Admin auth routes — self-contained (each route checks/issues the session itself)
app.use('/api/admin/auth', require('./routes/adminAuth'));

// Admin-only routes
app.use('/api/admin/requests', adminAuth, require('./routes/adminRequests'));
app.use('/api/profile', adminAuth, require('./routes/profile'));
app.use('/api/packages', adminAuth, require('./routes/packages'));
app.use('/api/clients', adminAuth, require('./routes/clients'));
app.use('/api/bookings', adminAuth, require('./routes/bookings'));
app.use('/api/calendar', require('./routes/calendar')); // auth applied per-route inside (shares prefix with /calendar/google)
app.use('/api/money-owed', adminAuth, require('./routes/moneyOwed'));
app.use('/api/second-shooters', adminAuth, require('./routes/secondShooters'));
app.use('/api/messages', adminAuth, require('./routes/messages'));
app.use('/api/reminders', adminAuth, require('./routes/reminders'));
app.use('/api/expenses', adminAuth, require('./routes/expenses'));
app.use('/api/dashboard', adminAuth, require('./routes/dashboard'));
app.use('/api/blocked-dates', adminAuth, require('./routes/blockedDates'));
app.use('/api/media', adminAuth, require('./routes/media'));
app.use('/api/galleries', adminAuth, require('./routes/galleries'));
app.use('/api/calendar/google', require('./routes/googleCalendar')); // auth applied per-route inside (excludes /callback)

// Machine-fetched calendar subscription feed (Google/Apple Calendar apps can't do cookie auth) —
// gated on a private per-photographer token instead (see routes/ics.js), not a login session.
app.use('/api/ics', require('./routes/ics'));

// Scheduled jobs. On Vercel, there's no long-running process for node-cron to schedule inside,
// so these are plain routes that Vercel Cron (see vercel.json) hits on a schedule instead; see
// services/cron.js for the local-dev node-cron scheduling of the same logic.
app.use('/api/cron', require('./routes/cron'));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'));
  });
}

// Catches anything a route handler throws/rejects and turns it into JSON instead of Express's
// default HTML error page (which leaks a stack trace with real server file paths).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message });
});

// node-cron needs a long-running process to hold its schedules in memory -- true locally, not
// true on Vercel (see routes/cron.js + vercel.json's own cron config for that environment).
if (!process.env.VERCEL) {
  require('./services/cron');
}

// Only binds a port when this file is run directly (`node src/index.js`), not when a serverless
// platform imports it as a module and calls the exported app itself.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
