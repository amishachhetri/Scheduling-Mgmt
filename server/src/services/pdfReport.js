const PDFDocument = require('pdfkit');
const { db } = require('../db/schema');

function money(n) {
  return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAGE_LEFT = 50;
const PAGE_RIGHT = 562;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

// Streams a one-page-plus annual summary PDF (gross income, expenses, second-shooter pay, net
// profit, estimated quarterly tax) with an itemized expense list underneath -- the same numbers
// shown on Settings -> Finances, just in a form that prints/saves cleanly for a tax preparer.
//
// Every block below tracks its own explicit y-coordinate rather than chaining off doc.y between
// calls -- pdfkit's text() mutates doc.y as a side effect even when given explicit x/y, so
// interleaving rect() fills with multiple text() calls off a shared doc.y silently drifts.
// Same "amount collected to date" formula as dashboard.js's /business (which feeds the Reports
// page) -- kept identical so this PDF and Reports never disagree on income for the same year.
const INCOME_EXPR = `CASE WHEN deposit_received = 1 THEN package_price - COALESCE(discount,0) - balance_due ELSE 0 END`;
const NOT_CANCELLED = `status NOT IN ('Cancelled','Denied','Requested')`;

async function streamAnnualReportPDF(res, year) {
  const profile = await db.get('SELECT name, business_name FROM photographer_profile WHERE id = 1');
  const income = await db.get(`SELECT COALESCE(SUM(${INCOME_EXPR}), 0) as total FROM bookings WHERE ${NOT_CANCELLED} AND TO_CHAR(shoot_date::date, 'YYYY') = ?`, [String(year)]);
  const expenseRows = await db.all(`SELECT description, amount, date, category, mileage FROM expenses WHERE TO_CHAR(date::date, 'YYYY') = ? ORDER BY date ASC`, [String(year)]);
  const expensesTotal = expenseRows.reduce((sum, e) => sum + (e.amount || 0), 0);
  const ssPayments = await db.get(`SELECT COALESCE(SUM(ss.pay_amount), 0) as total FROM second_shooters ss JOIN bookings b ON ss.booking_id = b.id WHERE ss.paid = 1 AND TO_CHAR(b.shoot_date::date, 'YYYY') = ?`, [String(year)]);
  const netProfit = income.total - expensesTotal - ssPayments.total;
  const estimatedTax = Math.max(0, netProfit * 0.25);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${year}-annual-summary.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'letter' });
  doc.pipe(res);

  let y = 50;
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#000').text(profile?.business_name || 'Photography Studio', PAGE_LEFT, y);
  y += 26;
  doc.fontSize(11).font('Helvetica').fillColor('#555').text(profile?.name || '', PAGE_LEFT, y);
  y += 26;
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(`${year} Annual Summary`, PAGE_LEFT, y);
  y += 20;
  doc.fontSize(9).font('Helvetica').fillColor('#888').text(
    `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    PAGE_LEFT, y
  );
  y += 28;

  const summaryRow = (label, value, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 12 : 11).fillColor('#000');
    doc.text(label, PAGE_LEFT, y);
    doc.text(value, PAGE_LEFT, y, { width: PAGE_WIDTH, align: 'right' });
    y += opts.bold ? 22 : 18;
  };

  summaryRow('Gross Income (collected to date)', money(income.total));
  summaryRow('Business Expenses', `-${money(expensesTotal)}`);
  summaryRow('Second Shooter Payments', `-${money(ssPayments.total)}`);
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor('#ddd').stroke();
  y += 14;
  summaryRow('Net Profit', money(netProfit), { bold: true });
  y += 12;

  const boxTop = y;
  const boxHeight = 54;
  doc.rect(PAGE_LEFT, boxTop, PAGE_WIDTH, boxHeight).fillColor('#fef3c7').fill();
  doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10)
    .text('Estimated Quarterly Tax (25% of net profit)', PAGE_LEFT + 12, boxTop + 10);
  doc.fontSize(16).text(`${money(estimatedTax / 4)} per quarter`, PAGE_LEFT + 12, boxTop + 26);
  y = boxTop + boxHeight + 30;

  doc.fillColor('#000').font('Helvetica-Bold').fontSize(13).text('Business Expenses', PAGE_LEFT, y);
  y += 22;

  if (expenseRows.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#888').text('No expenses logged for this year.', PAGE_LEFT, y);
  } else {
    const colX = { date: PAGE_LEFT, desc: 120, category: 340, amount: 460 };
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555');
    doc.text('Date', colX.date, y);
    doc.text('Description', colX.desc, y);
    doc.text('Category', colX.category, y);
    doc.text('Amount', colX.amount, y, { width: 102, align: 'right' });
    y += 14;
    doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor('#ddd').stroke();
    y += 10;

    doc.font('Helvetica').fontSize(9).fillColor('#000');
    for (const e of expenseRows) {
      if (y > 720) { doc.addPage(); y = 50; }
      doc.text(e.date, colX.date, y, { width: 65 });
      doc.text(e.description + (e.mileage ? ` (${e.mileage} mi)` : ''), colX.desc, y, { width: 210 });
      doc.text(e.category || 'General', colX.category, y, { width: 110 });
      doc.text(money(e.amount), colX.amount, y, { width: 102, align: 'right' });
      y += 18;
    }
  }

  doc.end();
}

module.exports = { streamAnnualReportPDF };
