const nodemailer = require('nodemailer');
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

async function getTransporter() {
  const profile = await db.get('SELECT * FROM photographer_profile WHERE id = 1');
  if (!profile?.smtp_host || !profile?.smtp_user || !profile?.smtp_pass) return null;
  return nodemailer.createTransport({
    host: profile.smtp_host,
    port: profile.smtp_port || 587,
    secure: profile.smtp_port === 465,
    auth: { user: profile.smtp_user, pass: profile.smtp_pass }
  });
}

function renderTemplate(body, vars) {
  return body.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : `{${key}}`;
  });
}

async function sendTemplateEmail(templateType, vars, delayDays = 0) {
  const template = await db.get('SELECT * FROM message_templates WHERE type = ? AND enabled = 1', [templateType]);
  if (!template) return { skipped: true, reason: 'template disabled or not found' };

  const profile = await db.get('SELECT * FROM photographer_profile WHERE id = 1');
  const allVars = { photographer_name: profile?.name || 'Photographer', ...vars };

  const subject = renderTemplate(template.subject, allVars);
  const body = renderTemplate(template.body, allVars);

  // Log it regardless of whether SMTP is configured
  const logId = uuidv4();
  await db.run(`
    INSERT INTO message_log (id, booking_id, client_id, client_name, template_type, subject, body, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [logId, vars.booking_id || null, vars.client_id || null, vars.client_name || '', templateType, subject, body, 'logged']);

  const transporter = await getTransporter();
  if (!transporter) return { logged: true, sent: false, reason: 'SMTP not configured' };

  const recipient = vars.to_email || vars.client_email;
  if (!recipient) return { logged: true, sent: false, reason: 'no recipient email' };

  if (delayDays > 0) {
    // For now, mark as scheduled (cron will pick up)
    await db.run("UPDATE message_log SET status = 'scheduled' WHERE id = ?", [logId]);
    return { logged: true, sent: false, scheduled: true };
  }

  try {
    await transporter.sendMail({
      from: profile.smtp_from || profile.smtp_user,
      to: recipient,
      subject,
      text: body
    });
    await db.run("UPDATE message_log SET status = 'sent' WHERE id = ?", [logId]);
    return { logged: true, sent: true };
  } catch (err) {
    await db.run("UPDATE message_log SET status = 'failed' WHERE id = ?", [logId]);
    throw err;
  }
}

module.exports = { sendTemplateEmail, renderTemplate, getTransporter };
