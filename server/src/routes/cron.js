const express = require('express');
const router = express.Router();
const { runDailyTasks } = require('../services/cron');

// Vercel Cron (see vercel.json) calls this on a schedule instead of node-cron, which has no
// long-running process to hold its schedule in on a serverless platform -- same underlying
// function services/cron.js uses for local-dev scheduling, just reached over HTTP here.
// Vercel signs these requests with this exact header; without CRON_SECRET set, anyone on the
// internet could otherwise trigger emails/SMS or the daily auto-complete logic at will.
function verifyCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Runs the day's reminder regeneration, follow-up emails, and auto-completions -- daily
// resolution is plenty since every reminder threshold (5/7/14/30 days) is day-granular anyway.
router.get('/daily', verifyCronSecret, async (req, res) => {
  await runDailyTasks();
  res.json({ success: true });
});

module.exports = router;
