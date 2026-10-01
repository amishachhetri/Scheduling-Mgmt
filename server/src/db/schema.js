const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/photographer.db');

const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photographer_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT 'Photographer',
      email TEXT,
      phone TEXT,
      business_name TEXT DEFAULT 'Photography Studio',
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_from TEXT,
      buffer_hours INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO photographer_profile (id, name) VALUES (1, 'Photographer');

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      shoot_type TEXT,
      is_full_day INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 120,
      included_photo_count INTEGER DEFAULT 0,
      extra_photo_price REAL,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      total_shoots INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      shoot_type TEXT NOT NULL,
      shoot_type_detail TEXT,
      shoot_date TEXT NOT NULL,
      shoot_time TEXT NOT NULL,
      shoot_end_time TEXT,
      location TEXT,
      package_id TEXT,
      package_name TEXT,
      package_price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      deposit_amount REAL DEFAULT 0,
      deposit_received INTEGER DEFAULT 0,
      balance_due REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'Upcoming',
      workflow_stage TEXT DEFAULT 'Shoot scheduled',
      workflow_stage_updated_at TEXT DEFAULT (datetime('now')),
      gallery_link TEXT,
      gallery_delivered_at TEXT,
      contract_signed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS booking_events (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS workflow_notes (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS second_shooters (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'Assistant Photographer',
      pay_amount REAL DEFAULT 0,
      pay_type TEXT DEFAULT 'flat',
      paid INTEGER DEFAULT 0,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS money_owed (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      notes TEXT,
      paid INTEGER DEFAULT 0,
      paid_at TEXT,
      type TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      end_date TEXT,
      label TEXT DEFAULT 'Blocked',
      all_day INTEGER DEFAULT 1,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      timing_days INTEGER DEFAULT 0,
      timing_direction TEXT DEFAULT 'before',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_log (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      client_id TEXT,
      client_name TEXT,
      template_type TEXT,
      subject TEXT,
      body TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'sent'
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      mileage REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio_media (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'photo',
      category TEXT NOT NULL DEFAULT 'Weddings',
      title TEXT,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      public_id TEXT,
      resource_type TEXT DEFAULT 'image',
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Client galleries, two flavors distinguished by the type column:
    --   'proofing' -- photographer uploads proofs, client picks favorites via a private link,
    --                 extra picks beyond the package's included count price automatically.
    --                 No downloads (these aren't the finished product).
    --   'final'    -- photographer uploads finished edits, client can browse and download them.
    --                 No favoriting (nothing left to pick).
    -- Separate from bookings.gallery_link, which is an external-service link (Pixieset, etc.)
    -- for photographers who deliver that way instead of/alongside uploading here.
    CREATE TABLE IF NOT EXISTS galleries (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'proofing',
      title TEXT,
      included_photo_count INTEGER DEFAULT 0,
      extra_photo_price REAL DEFAULT 0,
      access_token TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id TEXT PRIMARY KEY,
      gallery_id TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      public_id TEXT,
      resource_type TEXT DEFAULT 'image',
      sort_order INTEGER DEFAULT 0,
      favorited INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (gallery_id) REFERENCES galleries(id)
    );
  `);

  // Safe migrations for existing DBs
  const migrations = [
    `ALTER TABLE bookings ADD COLUMN shoot_end_time TEXT`,
    `ALTER TABLE bookings ADD COLUMN discount REAL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN shoot_type_detail TEXT`,
    `ALTER TABLE bookings ADD COLUMN google_calendar_event_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN cancellation_note TEXT`,
    `ALTER TABLE bookings ADD COLUMN deposit_decision TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN google_oauth_client_id TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN google_oauth_client_secret TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN google_oauth_refresh_token TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN google_calendar_id TEXT DEFAULT 'primary'`,
    `ALTER TABLE photographer_profile ADD COLUMN google_last_synced TEXT`,
    `ALTER TABLE bookings ADD COLUMN source TEXT DEFAULT 'manual'`,
    `ALTER TABLE bookings ADD COLUMN reference_code TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN twilio_account_sid TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN twilio_auth_token TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN twilio_from_number TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN bio TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN avatar_url TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN cover_photo_url TEXT`,
    `ALTER TABLE photographer_profile ADD COLUMN instagram_url TEXT`,
    `ALTER TABLE packages ADD COLUMN is_full_day INTEGER DEFAULT 0`,
    `ALTER TABLE photographer_profile ADD COLUMN ics_feed_token TEXT`,
    `ALTER TABLE packages ADD COLUMN included_photo_count INTEGER DEFAULT 0`,
    `ALTER TABLE galleries ADD COLUMN type TEXT NOT NULL DEFAULT 'proofing'`,
    `ALTER TABLE photographer_profile ADD COLUMN default_extra_photo_price REAL DEFAULT 15`,
    `ALTER TABLE packages ADD COLUMN extra_photo_price REAL`,
    `ALTER TABLE photographer_profile ADD COLUMN last_daily_run_date TEXT`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch {}
  }

  // Enforces what referenceCode.js's collision retry already assumes. A nullable column with a
  // UNIQUE index is fine in SQLite -- NULLs (bookings that haven't been finalized/quoted yet)
  // are never considered equal to each other or to anything else.
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_reference_code ON bookings(reference_code)`); } catch {}

  // Added separately (not in the shared array above) so we can tell whether this boot is the
  // one that actually introduces the column -- the duration backfill below must only ever run
  // once, on that boot, otherwise it would clobber a photographer's deliberate edit of a
  // package's duration back to the shoot-type default on every future restart.
  let justAddedDurationColumn = false;
  try {
    db.exec(`ALTER TABLE packages ADD COLUMN duration_minutes INTEGER DEFAULT 120`);
    justAddedDurationColumn = true;
  } catch {}

  // Backfill: existing wedding packages should block the whole day on the public
  // calendar; everything else defaults to timed-slot booking (is_full_day = 0).
  try {
    db.exec(`UPDATE packages SET is_full_day = 1 WHERE shoot_type LIKE 'Wedding%' AND is_full_day = 0`);
  } catch {}

  // The full ICS feed (GET /api/ics) has to be reachable without a login session for calendar
  // apps to subscribe to it -- this token is what keeps that URL from being a plain, guessable
  // window into every client's name/notes/balance. Generated once and kept stable so existing
  // subscriptions in Apple Calendar/Outlook don't silently break; regeneratable from Settings.
  const needsIcsToken = db.prepare('SELECT ics_feed_token FROM photographer_profile WHERE id = 1').get();
  if (needsIcsToken && !needsIcsToken.ics_feed_token) {
    db.prepare('UPDATE photographer_profile SET ics_feed_token = ? WHERE id = 1').run(crypto.randomBytes(24).toString('hex'));
  }

  // One-time backfill of duration for packages created before duration_minutes existed --
  // derived from shoot type, roughly matching the "N hour session" language already in each
  // description. Weddings get a full business-day span; everything else defaults shorter.
  if (justAddedDurationColumn) {
    try {
      db.exec(`
        UPDATE packages SET duration_minutes = CASE
          WHEN shoot_type LIKE 'Wedding%' THEN 480
          WHEN shoot_type IN ('Maternity', 'Baby') THEN 90
          WHEN shoot_type IN ('Pre-wedding', 'Post-wedding', 'Engagement') THEN 120
          WHEN shoot_type = 'Proposal' THEN 60
          WHEN shoot_type = 'Birthday' THEN 90
          ELSE 120
        END
      `);
    } catch {}
  }

  const insertTpl = db.prepare(`
    INSERT OR IGNORE INTO message_templates (id, type, subject, body, enabled, timing_days, timing_direction)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertTpl.run('tpl-confirm', 'booking_confirmation', 'Your booking is confirmed!',
    'Hi {client_name},\n\nYour {shoot_type} session is confirmed!\n\nDate: {shoot_date}\nTime: {shoot_time}\nLocation: {location}\n\nBalance due: ${balance_due}\n\nLooking forward to working with you!\n\n{photographer_name}',
    1, 0, 'after');
  insertTpl.run('tpl-payment', 'payment_reminder', 'Friendly payment reminder',
    'Hi {client_name},\n\nThis is a friendly reminder that your balance of ${balance_due} is due before your shoot on {shoot_date}.\n\nPlease reach out if you have any questions!\n\n{photographer_name}',
    1, 7, 'before');
  insertTpl.run('tpl-dayof', 'day_before_reminder', 'Your shoot is tomorrow!',
    'Hi {client_name},\n\nJust a reminder that your shoot is TOMORROW!\n\nDate: {shoot_date}\nTime: {shoot_time}\nLocation: {location}\n\nSee you then!\n\n{photographer_name}',
    1, 1, 'before');
  insertTpl.run('tpl-gallery', 'gallery_ready', 'Your gallery is ready!',
    'Hi {client_name},\n\nExciting news — your gallery is ready! You can view your photos here:\n\n{gallery_link}\n\nThank you for choosing us!\n\n{photographer_name}',
    1, 0, 'after');
  insertTpl.run('tpl-review', 'review_request', 'We would love your feedback!',
    'Hi {client_name},\n\nThank you so much for your session! We hope you love your photos.\n\nIf you have a moment, we would really appreciate a review -- it means the world to us!\n\nThank you,\n{photographer_name}',
    1, 3, 'after');
  insertTpl.run('tpl-request-received', 'booking_request_received', 'We got your booking request!',
    'Hi {client_name},\n\nThanks for requesting a {shoot_type} session on {shoot_date} at {shoot_time}!\n\nThis is a request, not a confirmed booking yet -- {photographer_name} will review it and get back to you shortly.\n\nYour reference code: {reference_code}\n\nTalk soon,\n{photographer_name}',
    1, 0, 'after');
  insertTpl.run('tpl-request-denied', 'booking_request_denied', 'About your booking request',
    'Hi {client_name},\n\nThank you for your interest in booking a {shoot_type} session on {shoot_date}. Unfortunately, {photographer_name} is unable to accommodate this request.\n\n{denial_reason}\n\nPlease feel free to reach out or submit a request for a different date.\n\nThank you,\n{photographer_name}',
    1, 0, 'after');
  insertTpl.run('tpl-new-request', 'new_request_notification', 'New booking request: {client_name}',
    'New booking request!\n\nClient: {client_name}\nEmail: {client_email}\nPhone: {client_phone}\nSession: {shoot_type}\nDate: {shoot_date} at {shoot_time}\nLocation: {location}\n\nReview and approve or deny it in your Requests inbox.',
    1, 0, 'after');
  insertTpl.run('tpl-confirmed-sms', 'booking_confirmed_sms', 'Booking confirmed (text message)',
    'Hi {client_name}! Your {shoot_type} on {shoot_date} is confirmed. View details & next steps: {status_link}',
    1, 0, 'after');

  // Default packages per shoot type. Wedding packages deliberately omit extra_photo_price
  // (stays NULL) -- weddings don't charge for extra photo picks, only timed/short sessions do.
  const insertPkg = db.prepare(`
    INSERT OR IGNORE INTO packages (id, name, description, price, shoot_type, duration_minutes, included_photo_count, extra_photo_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPkgFullDay = db.prepare(`
    INSERT OR IGNORE INTO packages (id, name, description, price, shoot_type, is_full_day, duration_minutes, included_photo_count)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  insertPkgFullDay.run('pkg-wedding-1d', 'Wedding (1 Day)', 'Full day coverage, ceremony & reception', 3500, 'Wedding (1 day)', 480, 400);
  insertPkgFullDay.run('pkg-wedding-md', 'Wedding (Multi-Day)', 'Multi-day coverage for all events', 5500, 'Wedding (multi-day)', 480, 600);
  insertPkg.run('pkg-maternity', 'Maternity Session', '1.5 hour session, online gallery', 450, 'Maternity', 90, 20, 15);
  insertPkg.run('pkg-baby', 'Baby Session', '1.5 hour session, online gallery', 450, 'Baby', 90, 20, 15);
  insertPkg.run('pkg-prewedding', 'Pre-Wedding Session', '2 hour session, 2 locations', 650, 'Pre-wedding', 120, 30, 15);
  insertPkg.run('pkg-postwedding', 'Post-Wedding Session', '2 hour session', 650, 'Post-wedding', 120, 30, 15);
  insertPkg.run('pkg-engagement', 'Engagement Session', '2 hour session, online gallery', 550, 'Engagement', 120, 30, 15);
  insertPkg.run('pkg-proposal', 'Proposal Session', '1 hour session', 375, 'Proposal', 60, 15, 15);
  insertPkg.run('pkg-birthday', 'Birthday Session', '1.5 hour session', 475, 'Birthday', 90, 20, 15);
}

module.exports = { db, initDB };
