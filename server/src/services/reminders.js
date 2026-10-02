const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

async function generateReminders() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  await db.run(`DELETE FROM reminders WHERE type IN ('no_followup', 'balance_unpaid', 'workflow_stuck', 'ss_payment', 'contract_unsigned') AND dismissed = 0`);

  const bookings = await db.all(`SELECT * FROM bookings WHERE status NOT IN ('Completed', 'Cancelled', 'Denied', 'Requested') AND deleted_at IS NULL`);

  const inserts = [];

  for (const b of bookings) {
    const shootDate = new Date(b.shoot_date + 'T00:00:00');
    const daysUntilShoot = Math.round((shootDate - today) / (1000 * 60 * 60 * 24));

    if (b.balance_due > 0 && daysUntilShoot <= 5 && daysUntilShoot >= 0) {
      inserts.push([uuidv4(), b.id, 'balance_unpaid', `Balance still unpaid — ${b.client_name}'s shoot is in ${daysUntilShoot} day${daysUntilShoot !== 1 ? 's' : ''}`]);
    }

    if (b.workflow_stage_updated_at) {
      const stageDate = new Date(b.workflow_stage_updated_at);
      const daysInStage = Math.round((today - stageDate) / (1000 * 60 * 60 * 24));
      if (daysInStage >= 7 && b.workflow_stage !== 'Project closed') {
        inserts.push([uuidv4(), b.id, 'workflow_stuck', `${b.client_name}'s shoot has been in '${b.workflow_stage}' for ${daysInStage} days`]);
      }
    }

    if (daysUntilShoot > 0 && daysUntilShoot <= 30) {
      const lastMsg = await db.get(`SELECT MAX(sent_at) as last FROM message_log WHERE booking_id = ?`, [b.id]);
      if (!lastMsg?.last) {
        inserts.push([uuidv4(), b.id, 'no_followup', `You haven't followed up with ${b.client_name} — shoot in ${daysUntilShoot} days`]);
      } else {
        const lastMsgDate = new Date(lastMsg.last);
        const daysSince = Math.round((today - lastMsgDate) / (1000 * 60 * 60 * 24));
        if (daysSince >= 14) {
          inserts.push([uuidv4(), b.id, 'no_followup', `No message to ${b.client_name} in ${daysSince} days — shoot in ${daysUntilShoot} days`]);
        }
      }
    }

    if (!b.contract_signed && daysUntilShoot <= 14 && daysUntilShoot >= 0) {
      inserts.push([uuidv4(), b.id, 'contract_unsigned', `Contract not yet signed — ${b.client_name}'s shoot is in ${daysUntilShoot} day${daysUntilShoot !== 1 ? 's' : ''}`]);
    }
  }

  const pendingSS = await db.all(`
    SELECT ss.*, b.client_name as shoot_client, b.shoot_date
    FROM second_shooters ss JOIN bookings b ON ss.booking_id = b.id
    WHERE ss.paid = 0 AND b.shoot_date < ? AND b.deleted_at IS NULL
  `, [todayStr]);

  for (const ss of pendingSS) {
    inserts.push([uuidv4(), ss.booking_id, 'ss_payment', `Second shooter payment pending: ${ss.name} for ${ss.shoot_client}'s shoot`]);
  }

  for (const row of inserts) {
    await db.run('INSERT INTO reminders (id, booking_id, type, message) VALUES (?, ?, ?, ?)', row);
  }
}

module.exports = { generateReminders };
