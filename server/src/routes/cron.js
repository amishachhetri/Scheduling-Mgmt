const express = require('express');
const router = express.Router();
const { runDailyTasks } = require('../services/cron');
const { generateReminders } = require('../services/reminders');

// Vercel Cron (see vercel.json) calls these on a schedule instead of node-cron, which has no
// long-running process to hold its schedules in on a serverless platform -- same underlying
// functions services/cron.js uses for local-dev scheduling, just reached over HTTP here.
// Vercel signs these requests with this exact header; without CRON_SECRET set, anyone on the
// internet could otherwise trigger emails/SMS or the daily auto-complete logic at will.
function verifyCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.get('/daily', verifyCronSecret, async (req, res) => {
  await runDailyTasks();
  res.json({ success: true });
});

router.get('/hourly', verifyCronSecret, async (req, res) => {
  await generateReminders();
  res.json({ success: true });
});

module.exports = router;
