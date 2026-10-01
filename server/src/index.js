require('dotenv').config();
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

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'));
  });
}

// Catches anything a route handler throws/rejects synchronously and turns it into JSON instead
// of Express's default HTML error page (which leaks a stack trace with real server file paths).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message });
});

initDB();

// Start cron jobs after DB init
require('./services/cron');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
