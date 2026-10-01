const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');

// Day-to-day operating data -- what the photographer needs to see and act on daily.
// Financial trend data (total/monthly/YTD income) lives on GET /business instead, since
// that's a "how's business doing" check, not a daily one.
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  // Rolling 4-week window (today -> +28 days) rather than a calendar month, so it always
  // shows a consistent amount of lookahead regardless of where in the month "today" falls.
  const monthEnd = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Three distinct "money" buckets, kept separate rather than one blended total:
  // 1. Owed TO him, tied to a booking, only once that shoot has already happened.
  const moneyOwedBookings = db.prepare(`
    SELECT COALESCE(SUM(m.amount), 0) as total FROM money_owed m JOIN bookings b ON m.booking_id = b.id
    WHERE m.paid = 0 AND b.shoot_date < date('now')
  `).get();
  // 2. Owed TO him, not tied to any booking (a loan, a print order, etc.).
  const moneyOwedManual = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM money_owed WHERE paid = 0 AND booking_id IS NULL
  `).get();
  // 3. Owed BY him -- unpaid second shooter / assistant photographer payouts.
  const moneyOwedByHim = db.prepare(`
    SELECT COALESCE(SUM(pay_amount), 0) as total FROM second_shooters WHERE paid = 0
  `).get();

  const upcomingCount = db.prepare(
    `SELECT COUNT(*) as count FROM bookings WHERE shoot_date >= ? AND shoot_date <= ? AND status = 'Upcoming'`
  ).get(today, monthEnd);

  const pendingRequests = db.prepare(
    `SELECT COUNT(*) as count FROM bookings WHERE status = 'Requested'`
  ).get();

  const reminders = db.prepare(`SELECT COUNT(*) as count FROM reminders WHERE dismissed = 0`).get();

  // Every booking still actively being worked, one row each -- this is what the interactive
  // "Active Projects" list on the home page renders, not just a stage-count summary.
  const activeProjects = db.prepare(`
    SELECT id, client_name, shoot_type, shoot_date, workflow_stage, status, balance_due
    FROM bookings
    WHERE status NOT IN ('Cancelled', 'Denied', 'Requested') AND workflow_stage != 'Project closed'
    ORDER BY shoot_date ASC
  `).all();

  // Recently closed-out work, for the collapsible "Past projects" section -- capped at 15;
  // the full history already lives on the Bookings page. Mutually exclusive with
  // active_projects above (exact complement on workflow_stage) so nothing double-counts --
  // a booking whose shoot already happened but whose workflow was never formally closed
  // (status Completed, workflow_stage still short of "Project closed") stays in Active,
  // since that's exactly the stalled work worth surfacing, not hiding.
  const pastProjects = db.prepare(`
    SELECT id, client_name, shoot_type, shoot_date, workflow_stage, status
    FROM bookings
    WHERE workflow_stage = 'Project closed'
    ORDER BY shoot_date DESC
    LIMIT 15
  `).all();

  const recentBookings = db.prepare(
    `SELECT id, client_name, shoot_type, shoot_date, status, created_at FROM bookings ORDER BY created_at DESC LIMIT 5`
  ).all();
  const recentMessages = db.prepare(
    `SELECT id, client_name, template_type, sent_at FROM message_log ORDER BY sent_at DESC LIMIT 5`
  ).all();
  const activity = [
    ...recentBookings.map(b => ({ type: 'booking', ...b, ts: b.created_at })),
    ...recentMessages.map(m => ({ type: 'message', ...m, ts: m.sent_at }))
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10);

  const upcomingShoots = db.prepare(
    `SELECT * FROM bookings WHERE shoot_date >= ? AND shoot_date <= ? AND status = 'Upcoming' ORDER BY shoot_date ASC, shoot_time ASC`
  ).all(today, monthEnd);

  res.json({
    money_owed_bookings: moneyOwedBookings.total,
    money_owed_manual: moneyOwedManual.total,
    money_owed_by_him: moneyOwedByHim.total,
    upcoming_this_month: upcomingCount.count,
    pending_requests: pendingRequests.count,
    active_reminders: reminders.count,
    active_projects: activeProjects,
    past_projects: pastProjects,
    recent_activity: activity,
    upcoming_shoots: upcomingShoots
  });
});

// Business-performance data -- MTD/YTD/overall income and profit, plus the monthly trend
// chart. Not part of the daily view; this is the "how's business doing overall" check.
router.get('/business', (req, res) => {
  const incomeExpr = `CASE WHEN deposit_received = 1 THEN package_price - COALESCE(discount,0) - balance_due ELSE 0 END`;
  const notCancelled = `status NOT IN ('Cancelled','Denied','Requested')`;

  const income = (whereExtra, params = []) => db.prepare(
    `SELECT COALESCE(SUM(${incomeExpr}), 0) as total FROM bookings WHERE ${notCancelled} ${whereExtra}`
  ).get(...params).total;

  const expenses = (whereExtra, params = []) => db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1 ${whereExtra}`
  ).get(...params).total;

  const secondShooterPay = (whereExtra, params = []) => db.prepare(
    `SELECT COALESCE(SUM(ss.pay_amount), 0) as total FROM second_shooters ss JOIN bookings b ON ss.booking_id = b.id WHERE ss.paid = 1 ${whereExtra}`
  ).get(...params).total;

  const periods = {
    mtd: { bookingsWhere: `AND strftime('%Y-%m', shoot_date) = strftime('%Y-%m', 'now')`, expensesWhere: `AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`, ssWhere: `AND strftime('%Y-%m', b.shoot_date) = strftime('%Y-%m', 'now')` },
    ytd: { bookingsWhere: `AND strftime('%Y', shoot_date) = strftime('%Y', 'now')`, expensesWhere: `AND strftime('%Y', date) = strftime('%Y', 'now')`, ssWhere: `AND strftime('%Y', b.shoot_date) = strftime('%Y', 'now')` },
    overall: { bookingsWhere: '', expensesWhere: '', ssWhere: '' }
  };

  const result = {};
  for (const [key, w] of Object.entries(periods)) {
    const inc = income(w.bookingsWhere);
    const exp = expenses(w.expensesWhere);
    const ss = secondShooterPay(w.ssWhere);
    result[key] = { income: inc, expenses: exp, second_shooter_payments: ss, net_profit: inc - exp - ss };
  }

  const monthlyIncome = db.prepare(`
    SELECT strftime('%Y-%m', shoot_date) as month,
      COALESCE(SUM(${incomeExpr}), 0) as income
    FROM bookings WHERE ${notCancelled} AND shoot_date >= date('now', '-11 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  res.json({ ...result, monthly_income: monthlyIncome });
});

function csvRow(values) {
  return values.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',');
}

function sendCSV(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([csvRow(headers), ...rows.map(csvRow)].join('\n'));
}

router.get('/export/bookings', (req, res) => {
  const bookings = db.prepare('SELECT * FROM bookings ORDER BY shoot_date DESC').all();
  sendCSV(res, 'bookings.csv',
    ['Date', 'Client', 'Email', 'Phone', 'Type', 'Location', 'Package', 'Price', 'Discount', 'Deposit', 'Balance', 'Status', 'Stage'],
    bookings.map(b => [
      b.shoot_date, b.client_name, b.client_email, b.client_phone,
      b.shoot_type, b.location, b.package_name, b.package_price,
      b.discount, b.deposit_amount, b.balance_due, b.status, b.workflow_stage
    ])
  );
});

router.get('/export/clients', (req, res) => {
  const clients = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id) as total_shoots,
      (SELECT COALESCE(SUM(b.deposit_amount), 0) FROM bookings b WHERE b.client_id = c.id AND b.deposit_received = 1) as total_spent
    FROM clients c ORDER BY c.name ASC
  `).all();
  sendCSV(res, 'clients.csv',
    ['Name', 'Email', 'Phone', 'Total Shoots', 'Total Spent'],
    clients.map(c => [c.name, c.email, c.phone, c.total_shoots, c.total_spent])
  );
});

module.exports = router;
