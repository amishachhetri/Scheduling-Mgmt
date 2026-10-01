const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { renderTemplate } = require('./email');

function getTwilioClient() {
  const profile = db.prepare('SELECT * FROM photographer_profile WHERE id = 1').get();
  if (!profile?.twilio_account_sid || !profile?.twilio_auth_token || !profile?.twilio_from_number) return null;
  const twilio = require('twilio');
  return { client: twilio(profile.twilio_account_sid, profile.twilio_auth_token), from: profile.twilio_from_number };
}

async function sendTemplateSMS(templateType, vars) {
  const template = db.prepare('SELECT * FROM message_templates WHERE type = ? AND enabled = 1').get(templateType);
  if (!template) return { skipped: true, reason: 'template disabled or not found' };

  const profile = db.prepare('SELECT * FROM photographer_profile WHERE id = 1').get();
  const allVars = { photographer_name: profile?.name || 'Photographer', ...vars };
  const body = renderTemplate(template.body, allVars);

  // Log it regardless of whether Twilio is configured -- same fallback philosophy as email.
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO message_log (id, booking_id, client_id, client_name, template_type, subject, body, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(logId, vars.booking_id || null, vars.client_id || null, vars.client_name || '', templateType, 'SMS', body, 'logged');

  const recipient = vars.to_phone || vars.client_phone;
  if (!recipient) return { logged: true, sent: false, reason: 'no recipient phone number' };

  const twilioConfig = getTwilioClient();
  if (!twilioConfig) {
    console.log(`[sms] Twilio not configured -- would text ${recipient}: ${body}`);
    return { logged: true, sent: false, reason: 'Twilio not configured' };
  }

  try {
    await twilioConfig.client.messages.create({ to: recipient, from: twilioConfig.from, body });
    db.prepare("UPDATE message_log SET status = 'sent' WHERE id = ?").run(logId);
    return { logged: true, sent: true };
  } catch (err) {
    db.prepare("UPDATE message_log SET status = 'failed' WHERE id = ?").run(logId);
    console.error('[sms] send failed:', err.message);
    return { logged: true, sent: false, reason: err.message };
  }
}

module.exports = { sendTemplateSMS, getTwilioClient };
