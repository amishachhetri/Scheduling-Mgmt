const express = require('express');
const router = express.Router();
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { streamAnnualReportPDF } = require('../services/pdfReport');

router.get('/', async (req, res) => {
  const { booking_id } = req.query;
  let q = 'SELECT e.*, b.client_name, b.shoot_date FROM expenses e LEFT JOIN bookings b ON e.booking_id = b.id WHERE 1=1';
  const params = [];
  if (booking_id) { q += ' AND e.booking_id = ?'; params.push(booking_id); }
  q += ' ORDER BY e.date DESC';
  res.json(await db.all(q, params));
});

router.post('/', async (req, res) => {
  const { booking_id, description, amount, date, category, mileage } = req.body;
  if (!description || !amount || !date) return res.status(400).json({ error: 'description, amount, date required' });
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });
  const id = uuidv4();
  await db.run('INSERT INTO expenses (id, booking_id, description, amount, date, category, mileage) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, booking_id, description, parsedAmount, date, category || 'General', mileage ? parseFloat(mileage) : null]);
  res.json(await db.get('SELECT * FROM expenses WHERE id = ?', [id]));
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT id FROM expenses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Income here is "amount actually collected to date" (price minus discount minus whatever
// balance is still outstanding), the same formula dashboard.js's /business uses for Reports --
// this used to sum only deposit_amount, which understated income for anything paid beyond
// the initial deposit and disagreed with the Reports page for the same year.
const INCOME_EXPR = `CASE WHEN deposit_received = 1 THEN package_price - COALESCE(discount,0) - balance_due ELSE 0 END`;
const NOT_CANCELLED = `status NOT IN ('Cancelled','Denied','Requested') AND deleted_at IS NULL`;

router.get('/summary', async (req, res) => {
  const { year } = req.query;
  const y = year || new Date().getFullYear();
  const income = await db.get(`SELECT COALESCE(SUM(${INCOME_EXPR}), 0) as total FROM bookings WHERE ${NOT_CANCELLED} AND TO_CHAR(shoot_date::date, 'YYYY') = ?`, [String(y)]);
  const expenses = await db.get(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE TO_CHAR(date::date, 'YYYY') = ?`, [String(y)]);
  const ssPayments = await db.get(`SELECT COALESCE(SUM(ss.pay_amount), 0) as total FROM second_shooters ss JOIN bookings b ON ss.booking_id = b.id WHERE ss.paid = 1 AND TO_CHAR(b.shoot_date::date, 'YYYY') = ?`, [String(y)]);
  const net = income.total - expenses.total - ssPayments.total;
  res.json({
    income: income.total,
    expenses: expenses.total,
    second_shooter_payments: ssPayments.total,
    net_profit: net,
    estimated_quarterly_tax: Math.max(0, net * 0.25)
  });
});

// GET /api/expenses/summary/pdf?year=X — same numbers as /summary, formatted as a downloadable
// PDF with an itemized expense list, for handing to a tax preparer or keeping for records.
router.get('/summary/pdf', async (req, res) => {
  const y = req.query.year || new Date().getFullYear();
  await streamAnnualReportPDF(res, y);
});

// GET /api/expenses/export?year=X — the full itemized expense list as CSV, optionally filtered
// to one year (omit year for everything on file).
router.get('/export', async (req, res) => {
  const { year } = req.query;
  const rows = year
    ? await db.all(`SELECT description, amount, date, category, mileage FROM expenses WHERE TO_CHAR(date::date, 'YYYY') = ? ORDER BY date ASC`, [String(year)])
    : await db.all(`SELECT description, amount, date, category, mileage FROM expenses ORDER BY date ASC`);
  const headers = ['Date', 'Description', 'Category', 'Amount', 'Mileage'];
  const csvRows = rows.map(e => [e.date, e.description, e.category, e.amount, e.mileage ?? '']
    .map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="expenses${year ? '-' + year : ''}.csv"`);
  res.send([headers.join(','), ...csvRows].join('\n'));
});

module.exports = router;
