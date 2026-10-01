const cron = require('node-cron');
const { db, NOW_TS, NOW_DATE } = require('../db/schema');
const { sendTemplateEmail } = require('./email');
const { generateReminders } = require('./reminders');

async function runDailyTasks() {
  console.log('[cron] Running daily tasks...');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Day-before reminders
  const tomorrowShoots = await db.all(`SELECT * FROM bookings WHERE shoot_date = ? AND status = 'Upcoming'`, [tomorrowStr]);
  for (const b of tomorrowShoots) {
    sendTemplateEmail('day_before_reminder', {
      booking_id: b.id, client_id: b.client_id,
      client_name: b.client_name, client_email: b.client_email,
      shoot_date: b.shoot_date, shoot_time: b.shoot_time, location: b.location
    }).catch(console.error);
  }

  // Payment reminders (7 days before)
  const template = await db.get(`SELECT * FROM message_templates WHERE type = 'payment_reminder' AND enabled = 1`);
  if (template) {
    const days = template.timing_days || 7;
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const unpaid = await db.all(`SELECT * FROM bookings WHERE shoot_date = ? AND balance_due > 0 AND deposit_received = 0 AND status = 'Upcoming'`, [targetDate]);
    for (const b of unpaid) {
      sendTemplateEmail('payment_reminder', {
        booking_id: b.id, client_id: b.client_id,
        client_name: b.client_name, client_email: b.client_email,
        balance_due: b.balance_due, shoot_date: b.shoot_date
      }).catch(console.error);
    }
  }

  // Review requests (3 days after project closed)
  const completedRecently = await db.all(`
    SELECT * FROM bookings WHERE status = 'Completed' AND TO_CHAR(updated_at::timestamp, 'YYYY-MM-DD') = TO_CHAR((NOW() AT TIME ZONE 'UTC') - INTERVAL '3 days', 'YYYY-MM-DD')
  `);
  for (const b of completedRecently) {
    const alreadySent = await db.get(`SELECT id FROM message_log WHERE booking_id = ? AND template_type = 'review_request'`, [b.id]);
    if (!alreadySent) {
      sendTemplateEmail('review_request', {
        booking_id: b.id, client_id: b.client_id,
        client_name: b.client_name, client_email: b.client_email
      }).catch(console.error);
    }
  }

  // Auto-mark past shoots as completed (if still "Upcoming"), regardless of how far the workflow
  // has progressed -- "Upcoming" specifically means "hasn't happened yet," so once the date has
  // passed it no longer applies no matter what stage the admin has advanced it to. Only bump
  // workflow_stage itself if nothing had been recorded yet; leave further-along stages alone.
  await db.run(`
    UPDATE bookings SET
      status = 'Completed',
      workflow_stage = CASE WHEN workflow_stage = 'Shoot scheduled' THEN 'Shoot completed' ELSE workflow_stage END,
      updated_at = ${NOW_TS}
    WHERE shoot_date < ? AND status = 'Upcoming'
  `, [todayStr]);

  // Generate reminder alerts
  await generateReminders();

  await db.run(`UPDATE photographer_profile SET last_daily_run_date = ${NOW_DATE} WHERE id = 1`);

  console.log('[cron] Daily tasks complete');
}

// Local-dev-only scheduling -- a long-running `node src/index.js` process can hold these
// schedules in memory. In production on Vercel there's no such process (see routes/cron.js +
// vercel.json's own cron config, which call the exact same functions on a schedule instead).

// Run daily at 8am
cron.schedule('0 8 * * *', runDailyTasks);

// Run once on startup
setTimeout(() => generateReminders().catch(console.error), 2000);

// Catch up if the server was down (or just restarted) when the 8am job would have run --
// otherwise a photographer whose server happened to be offline at 8am simply never gets that
// day's reminders/auto-completions until the following day's run.
setTimeout(async () => {
  try {
    const profile = await db.get('SELECT last_daily_run_date FROM photographer_profile WHERE id = 1');
    const todayStr = new Date().toISOString().split('T')[0];
    if (profile?.last_daily_run_date !== todayStr) {
      console.log('[cron] Missed daily run detected on startup, catching up now...');
      await runDailyTasks();
    }
  } catch (err) { console.error(err); }
}, 3000);

module.exports = { runDailyTasks };
