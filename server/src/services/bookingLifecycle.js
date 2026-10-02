const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { sendTemplateEmail } = require('./email');
const { sendTemplateSMS } = require('./sms');
const { generateUniqueReferenceCode } = require('./referenceCode');
const gcal = require('./googleCalendar');
const cloudinary = require('./cloudinary');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Side effects that turn a booking into a confirmed, tracked shoot: money owed,
// client stats, confirmation email + SMS, dashboard reminders, calendar sync.
// Shared by direct admin creation (already-Upcoming bookings) and request approval
// (Requested -> Upcoming) so both paths behave identically.
async function finalizeApprovedBooking(bookingId) {
  let booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) throw new Error('Booking not found');

  // Every confirmed booking needs a reference code for the client status-lookup page/SMS link --
  // bookings created directly by the photographer (not via a public request) don't have one yet.
  if (!booking.reference_code) {
    const referenceCode = await generateUniqueReferenceCode();
    await db.run('UPDATE bookings SET reference_code = ? WHERE id = ?', [referenceCode, bookingId]);
    booking = { ...booking, reference_code: referenceCode };
  }

  const existingOwed = await db.get('SELECT id FROM money_owed WHERE booking_id = ?', [bookingId]);
  if (!existingOwed && booking.balance_due > 0) {
    await db.run(`INSERT INTO money_owed (id, booking_id, name, amount, notes, type) VALUES (?, ?, ?, ?, ?, 'booking')`,
      [uuidv4(), bookingId, booking.client_name, booking.balance_due, `Balance for ${booking.shoot_type} shoot on ${booking.shoot_date}`]);
  }

  await db.run(`UPDATE clients SET total_shoots = total_shoots + 1, updated_at = ${NOW_TS} WHERE id = ?`, [booking.client_id]);

  // A booking entered directly as Completed/Cancelled/Denied is a historical/backfilled record,
  // not a live one -- skip the client-facing "your booking is confirmed" email/SMS and calendar
  // sync, which would be wrong to send for something that (as far as this record states) already
  // happened or never will.
  const isLive = !['Completed', 'Cancelled', 'Denied'].includes(booking.status);
  if (isLive) {
    sendTemplateEmail('booking_confirmation', {
      booking_id: bookingId, client_id: booking.client_id, client_name: booking.client_name, client_email: booking.client_email,
      shoot_type: booking.shoot_type, shoot_date: booking.shoot_date, shoot_time: booking.shoot_time,
      location: booking.location, balance_due: booking.balance_due
    }).catch(console.error);

    const statusLink = `${CLIENT_URL}/status?code=${booking.reference_code}&email=${encodeURIComponent(booking.client_email || '')}`;
    sendTemplateSMS('booking_confirmed_sms', {
      booking_id: bookingId, client_id: booking.client_id, client_name: booking.client_name, client_phone: booking.client_phone,
      shoot_type: booking.shoot_type, shoot_date: booking.shoot_date, status_link: statusLink
    }).catch(console.error);
  }

  const finalized = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (isLive) gcal.createEvent(finalized).catch(console.error);
  return finalized;
}

// The actual hard delete, run once a trashed booking's 24-hour window is up (see
// services/cron.js). The Google Calendar event is already gone by this point -- that happens
// immediately when the booking is trashed, not deferred to purge time.
async function permanentlyDeleteBooking(bookingId) {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return;
  // Children first -- FK constraints reject deleting a bookings row while these still reference it.
  const galleries = await db.all('SELECT * FROM galleries WHERE booking_id = ?', [bookingId]);
  for (const gallery of galleries) {
    const photos = await db.all('SELECT * FROM gallery_photos WHERE gallery_id = ?', [gallery.id]);
    await db.run('DELETE FROM gallery_photos WHERE gallery_id = ?', [gallery.id]);
    if (cloudinary.isConfigured()) {
      for (const p of photos) {
        if (p.public_id) cloudinary.deleteAsset(p.public_id, p.resource_type || 'image').catch(console.error);
      }
    }
  }
  await db.run('DELETE FROM galleries WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM second_shooters WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM workflow_notes WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM money_owed WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM reminders WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM booking_events WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM message_log WHERE booking_id = ?', [bookingId]);
  await db.run('DELETE FROM bookings WHERE id = ?', [bookingId]);
}

module.exports = { finalizeApprovedBooking, permanentlyDeleteBooking };
