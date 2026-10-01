/**
 * Seed script — populates the DB with realistic sample data.
 * Run from /server: node seed.js
 * Wipes existing bookings/clients/money_owed/workflow_notes first.
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { db } = require('./src/db/schema');

const AGO_TS = `TO_CHAR((NOW() AT TIME ZONE 'UTC') - (? || ' days')::interval, 'YYYY-MM-DD HH24:MI:SS')`;

// ── helpers ───────────────────────────────────────────────────────────────────
function d(offset) {
  const dt = new Date('2026-07-02');
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split('T')[0];
}

async function mkClient(name, email, phone, shoots = 1) {
  const id = uuidv4();
  await db.run(`INSERT INTO clients (id, name, email, phone, total_shoots) VALUES (?, ?, ?, ?, ?)`,
    [id, name, email, phone, shoots]);
  return id;
}

async function mkBooking({
  clientId, clientName, clientEmail, clientPhone,
  type, date, time = '10:00', endTime = null, location = '',
  pkg = null, pkgName = null, price = 0, deposit = 0, depositReceived = false,
  balance = null, status = 'Upcoming', stage = 'Shoot scheduled',
  notes = null, galleryLink = null
}) {
  const id = uuidv4();
  const bal = balance !== null ? balance : Math.max(0, price - deposit);
  await db.run(`
    INSERT INTO bookings (
      id, client_id, client_name, client_email, client_phone,
      shoot_type, shoot_date, shoot_time, shoot_end_time, location,
      package_id, package_name, package_price, deposit_amount, deposit_received,
      balance_due, notes, status, workflow_stage, gallery_link,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${AGO_TS}, ${AGO_TS})
  `, [
    id, clientId, clientName, clientEmail, clientPhone,
    type, date, time, endTime, location,
    pkg, pkgName, price, deposit, depositReceived ? 1 : 0,
    bal, notes, status, stage, galleryLink,
    0, 0
  ]);
  return id;
}

async function mkNote(bookingId, stage, note, daysAgo = 0) {
  await db.run(`INSERT INTO workflow_notes (id, booking_id, stage, note, created_at)
    VALUES (?, ?, ?, ?, ${AGO_TS})`,
    [uuidv4(), bookingId, stage, note, daysAgo]);
}

async function mkOwed(bookingId, name, amount, paid = false, paidAt = null, notes = '') {
  await db.run(`INSERT INTO money_owed (id, booking_id, name, amount, notes, type, paid, paid_at)
    VALUES (?, ?, ?, ?, ?, 'booking', ?, ?)`,
    [uuidv4(), bookingId, name, amount, notes, paid ? 1 : 0, paidAt]);
}

async function mkEvent(bookingId, name, date, time = null) {
  await db.run(`INSERT INTO booking_events (id, booking_id, event_name, event_date, event_time)
    VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), bookingId, name, date, time]);
}

async function mkAssistant(bookingId, name, role = 'Assistant Photographer', pay = 300, paid = false) {
  await db.run(`INSERT INTO second_shooters (id, booking_id, name, role, pay_amount, pay_type, paid)
    VALUES (?, ?, ?, ?, ?, 'flat', ?)`,
    [uuidv4(), bookingId, name, role, pay, paid ? 1 : 0]);
}

async function main() {
  // ── wipe existing data ──────────────────────────────────────────────────────
  const tables = [
    'workflow_notes', 'booking_events', 'second_shooters',
    'message_log', 'money_owed', 'reminders', 'bookings', 'clients', 'blocked_dates'
  ];
  for (const t of tables) await db.run(`DELETE FROM ${t}`);
  console.log('Cleared existing data.');

  // ── CLIENTS ─────────────────────────────────────────────────────────────────
  const rohan      = await mkClient('Rohan & Priya Shah',    'priya.shah@gmail.com',    '408-555-0101', 2);
  const anika      = await mkClient('Anika Patel',           'anika.patel@email.com',   '510-555-0202', 1);
  const kabir      = await mkClient('Kabir & Simran Kapoor', 'simran.kapoor@gmail.com', '415-555-0303', 2);
  const riya       = await mkClient('Riya Mehta',            'riya.mehta@gmail.com',    '650-555-0404', 1);
  const vivek      = await mkClient('Vivek & Ananya Joshi',  'ananya.joshi@email.com',  '408-555-0505', 2);
  const sana       = await mkClient('Sana Ali',              'sana.ali@gmail.com',      '925-555-0606', 1);
  const kavya      = await mkClient('Kavya & Arjun Bose',   'kavya.bose@gmail.com',    '510-555-0707', 1);
  const naina      = await mkClient('Naina Sharma',          'naina.sharma@email.com',  '415-555-0808', 1);
  const deepak     = await mkClient('Deepak & Meera Verma', 'meera.verma@gmail.com',   '650-555-0909', 2);
  const ruchika    = await mkClient('Ruchika Agarwal',       'ruchika.a@gmail.com',     '408-555-1010', 1);
  const neel       = await mkClient('Neel & Tara Malhotra',  'tara.malhotra@gmail.com', '415-555-1111', 1);
  const sunita     = await mkClient('Sunita Gupta',          'sunita.gupta@email.com',  '510-555-1212', 1);
  const aarav      = await mkClient('Aarav & Ishita Kumar',  'ishita.kumar@gmail.com',  '925-555-1313', 1);
  const pooja      = await mkClient('Pooja Nair',            'pooja.nair@gmail.com',    '408-555-1414', 1);
  const rhea       = await mkClient('Rhea & Vikram Choudhary','rhea.choudhary@gmail.com','415-555-1515', 1);
  const leila      = await mkClient('Leila & Aryan Banerjee','leila.banerjee@email.com','510-555-1616', 1);
  const tanya      = await mkClient('Tanya Khanna',          'tanya.khanna@gmail.com',  '650-555-1717', 1);

  // ── PAST BOOKINGS (completed shoots) ───────────────────────────────────────

  // 1. Rohan & Priya Shah — Wedding (Nov 2025) — completed, paid, gallery delivered
  const b1 = await mkBooking({
    clientId: rohan, clientName: 'Rohan & Priya Shah',
    clientEmail: 'priya.shah@gmail.com', clientPhone: '408-555-0101',
    type: 'Wedding (1 day)', date: '2025-11-14', time: '09:00', endTime: '21:00',
    location: 'The Westin San Jose, CA',
    pkg: 'pkg-wedding-1d', pkgName: 'Wedding (1 Day)',
    price: 3500, deposit: 1000, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    galleryLink: 'https://share.pixieset.com/rohan-priya-wedding-2025',
    notes: 'Beautiful outdoor ceremony. Bridal party of 8.'
  });
  await mkNote(b1, 'Shoot completed',                'Ceremony + reception, ~1200 shots', 229);
  await mkNote(b1, 'Sent to client for selection',   'Sent culled gallery (420 images)',  220);
  await mkNote(b1, 'Editing in progress',            'Full edit started',                 210);
  await mkNote(b1, 'Editing complete',               'Delivered 380 edited images',       200);
  await mkNote(b1, 'Final products delivered',       'Gallery live on Pixieset',          195);
  await mkNote(b1, 'Project closed',                 'All prints delivered, client loved the album!', 180);
  await mkOwed(b1, 'Rohan & Priya Shah', 2500, true, '2025-11-30', 'Balance for Wedding (1 day) shoot on 2025-11-14');

  // 2. Anika Patel — Maternity (Dec 2025) — completed, paid
  const b2 = await mkBooking({
    clientId: anika, clientName: 'Anika Patel',
    clientEmail: 'anika.patel@email.com', clientPhone: '510-555-0202',
    type: 'Maternity', date: '2025-12-06', time: '10:00', endTime: '12:00',
    location: 'Coyote Hills Regional Park, Fremont CA',
    pkg: 'pkg-maternity', pkgName: 'Maternity Session',
    price: 450, deposit: 150, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    notes: '34 weeks. Golden hour session at the park.'
  });
  await mkNote(b2, 'Shoot completed',   '2-hour golden hour session, ~300 shots', 208);
  await mkNote(b2, 'Editing complete',  '45 fully edited images delivered',       200);
  await mkNote(b2, 'Project closed',    'Client posted favorites to Instagram!',  195);
  await mkOwed(b2, 'Anika Patel', 300, true, '2025-12-20', 'Balance for Maternity shoot on 2025-12-06');

  // 3. Kabir & Simran — Engagement (Jan 2026) — completed, paid
  const b3 = await mkBooking({
    clientId: kabir, clientName: 'Kabir & Simran Kapoor',
    clientEmail: 'simran.kapoor@gmail.com', clientPhone: '415-555-0303',
    type: 'Engagement', date: '2026-01-18', time: '15:30', endTime: '17:30',
    location: 'Baker Beach, San Francisco CA',
    pkg: 'pkg-engagement', pkgName: 'Engagement Session',
    price: 550, deposit: 200, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    notes: 'Golden Gate Bridge backdrop. Brought their dog!'
  });
  await mkNote(b3, 'Shoot completed',  'Great natural chemistry, 260 shots', 165);
  await mkNote(b3, 'Editing complete', '60 images delivered',               158);
  await mkNote(b3, 'Project closed',   'Approved gallery, wedding booked for Oct 2026', 152);
  await mkOwed(b3, 'Kabir & Simran Kapoor', 350, true, '2026-02-05', 'Balance for Engagement shoot on 2026-01-18');

  // 4. Riya Mehta — Birthday (Feb 2026) — completed, paid
  const b4 = await mkBooking({
    clientId: riya, clientName: 'Riya Mehta',
    clientEmail: 'riya.mehta@gmail.com', clientPhone: '650-555-0404',
    type: 'Birthday', date: '2026-02-22', time: '11:00', endTime: '13:00',
    location: 'Client Home, Palo Alto CA',
    pkg: 'pkg-birthday', pkgName: 'Birthday Session',
    price: 475, deposit: 150, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    notes: '30th birthday surprise party setup + portraits.'
  });
  await mkNote(b4, 'Shoot completed',  '3-hour party coverage + portraits', 130);
  await mkNote(b4, 'Editing complete', '75 images delivered',               124);
  await mkNote(b4, 'Project closed',   'Used photos for Instagram highlight reel', 118);
  await mkOwed(b4, 'Riya Mehta', 325, true, '2026-03-10', 'Balance for Birthday shoot on 2026-02-22');

  // 5. Vivek & Ananya — Pre-Wedding (March 2026) — completed, paid, wedding booked
  const b5 = await mkBooking({
    clientId: vivek, clientName: 'Vivek & Ananya Joshi',
    clientEmail: 'ananya.joshi@email.com', clientPhone: '408-555-0505',
    type: 'Pre-wedding', date: '2026-03-08', time: '07:00', endTime: '10:00',
    location: 'Filoli Historic House & Garden, Woodside CA',
    pkg: 'pkg-prewedding', pkgName: 'Pre-Wedding Session',
    price: 650, deposit: 200, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    notes: 'Sunrise session. Wore traditional outfits + one Western look.',
    galleryLink: 'https://share.pixieset.com/vivek-ananya-prewedding'
  });
  await mkNote(b5, 'Shoot completed',         'Stunning sunrise shots, ~400 frames', 116);
  await mkNote(b5, 'Final products delivered','Gallery + 20 prints ordered',          110);
  await mkNote(b5, 'Project closed',          'Wedding confirmed for August 2026',    105);
  await mkOwed(b5, 'Vivek & Ananya Joshi', 450, true, '2026-03-25', 'Balance for Pre-wedding shoot on 2026-03-08');

  // 6. Sana Ali — Portrait (April 2026) — completed, paid
  const b6 = await mkBooking({
    clientId: sana, clientName: 'Sana Ali',
    clientEmail: 'sana.ali@gmail.com', clientPhone: '925-555-0606',
    type: 'Portrait', date: '2026-04-12', time: '14:00', endTime: '16:00',
    location: 'Downtown Oakland, CA',
    pkg: '22487c25-b072-429d-a7c9-0b70977cb3f3', pkgName: 'Portrait Session',
    price: 350, deposit: 100, depositReceived: true,
    balance: 0, status: 'Completed', stage: 'Project closed',
    notes: 'LinkedIn headshots + lifestyle portraits for personal brand.'
  });
  await mkNote(b6, 'Shoot completed',  '2-hour street + studio blend, 180 shots', 81);
  await mkNote(b6, 'Editing complete', '30 hero images selected and retouched',   75);
  await mkNote(b6, 'Project closed',   'Used headshot on LinkedIn — got a new job offer!', 70);
  await mkOwed(b6, 'Sana Ali', 250, true, '2026-04-28', 'Balance for Portrait shoot on 2026-04-12');

  // 7. Kavya & Arjun Bose — Wedding (May 2026) — completed, balance still owed
  const b7 = await mkBooking({
    clientId: kavya, clientName: 'Kavya & Arjun Bose',
    clientEmail: 'kavya.bose@gmail.com', clientPhone: '510-555-0707',
    type: 'Wedding (1 day)', date: '2026-05-03', time: '08:30', endTime: '22:00',
    location: 'Preservation Park, Oakland CA',
    pkg: 'pkg-wedding-1d', pkgName: 'Wedding (1 Day)',
    price: 3500, deposit: 1500, depositReceived: true,
    balance: 2000, status: 'Upcoming', stage: 'Editing in progress',
    notes: 'Nikah ceremony + reception. Second shooter requested.',
    galleryLink: null
  });
  await mkNote(b7, 'Shoot completed',               '~1400 frames, outdoor ceremony with string lights', 60);
  await mkNote(b7, 'Sent to client for selection',  'Culled to 500, sent for selection',                 50);
  await mkNote(b7, 'Editing in progress',           'Started full edit batch',                           40);
  await mkAssistant(b7, 'Preethi Nair', 'Assistant Photographer', 350, true);
  await mkOwed(b7, 'Kavya & Arjun Bose', 2000, false, null, 'Balance for Wedding (1 day) shoot on 2026-05-03');

  // 8. Naina Sharma — Maternity (June 2026) — recent, sent for selection
  const b8 = await mkBooking({
    clientId: naina, clientName: 'Naina Sharma',
    clientEmail: 'naina.sharma@email.com', clientPhone: '415-555-0808',
    type: 'Maternity', date: '2026-06-14', time: '18:00', endTime: '20:00',
    location: 'Lands End, San Francisco CA',
    pkg: 'pkg-maternity', pkgName: 'Maternity Session',
    price: 450, deposit: 150, depositReceived: true,
    balance: 300, status: 'Upcoming', stage: 'Sent to client for selection',
    notes: '36 weeks. Husband joined for last 30 min of shoot.'
  });
  await mkNote(b8, 'Shoot completed',              'Golden hour session, 280 shots',       18);
  await mkNote(b8, 'Sent to client for selection', 'Gallery of 90 images shared for picks', 12);
  await mkOwed(b8, 'Naina Sharma', 300, false, null, 'Balance for Maternity shoot on 2026-06-14');

  // 9. Deepak & Meera Verma — Engagement (June 2026) — editing complete
  const b9 = await mkBooking({
    clientId: deepak, clientName: 'Deepak & Meera Verma',
    clientEmail: 'meera.verma@gmail.com', clientPhone: '650-555-0909',
    type: 'Engagement', date: '2026-06-28', time: '16:00', endTime: '18:30',
    location: 'Saratoga Foothill Club, Saratoga CA',
    pkg: 'pkg-engagement', pkgName: 'Engagement Session',
    price: 550, deposit: 200, depositReceived: true,
    balance: 350, status: 'Upcoming', stage: 'Editing complete',
    notes: 'Outdoor garden venue. Wedding booked at same location Nov 2026.'
  });
  await mkNote(b9, 'Shoot completed',   '~220 shots, incredible golden light', 4);
  await mkNote(b9, 'Editing in progress', 'Full edit underway',                3);
  await mkNote(b9, 'Editing complete',  '55 edited images ready to deliver',   1);
  await mkOwed(b9, 'Deepak & Meera Verma', 350, false, null, 'Balance for Engagement shoot on 2026-06-28');

  // ── UPCOMING BOOKINGS ───────────────────────────────────────────────────────

  // 10. Ruchika Agarwal — Portrait (July 5 — this week!)
  const b10 = await mkBooking({
    clientId: ruchika, clientName: 'Ruchika Agarwal',
    clientEmail: 'ruchika.a@gmail.com', clientPhone: '408-555-1010',
    type: 'Portrait', date: d(3), time: '09:00', endTime: '11:00',
    location: 'Japanese Tea Garden, San Francisco CA',
    pkg: '22487c25-b072-429d-a7c9-0b70977cb3f3', pkgName: 'Portrait Session',
    price: 350, deposit: 100, depositReceived: true,
    balance: 250, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'Professional headshots + creative portraits. Client is an author.'
  });
  await mkOwed(b10, 'Ruchika Agarwal', 250, false, null, 'Balance for Portrait shoot on ' + d(3));

  // 11. Neel & Tara Malhotra — Pre-Wedding (July 12)
  const b11 = await mkBooking({
    clientId: neel, clientName: 'Neel & Tara Malhotra',
    clientEmail: 'tara.malhotra@gmail.com', clientPhone: '415-555-1111',
    type: 'Pre-wedding', date: d(10), time: '07:30', endTime: '10:30',
    location: 'Palace of Fine Arts, San Francisco CA',
    pkg: 'pkg-prewedding', pkgName: 'Pre-Wedding Session',
    price: 650, deposit: 200, depositReceived: false,
    balance: 650, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'Two outfit changes. Both traditional. Requested fog shots.'
  });
  await mkOwed(b11, 'Neel & Tara Malhotra', 650, false, null, 'Balance for Pre-wedding shoot on ' + d(10));

  // 12. Sunita Gupta — Baby Session (July 19)
  const b12 = await mkBooking({
    clientId: sunita, clientName: 'Sunita Gupta',
    clientEmail: 'sunita.gupta@email.com', clientPhone: '510-555-1212',
    type: 'Baby', date: d(17), time: '10:00', endTime: '12:00',
    location: 'Client Home, Fremont CA',
    pkg: 'pkg-baby', pkgName: 'Baby Session',
    price: 450, deposit: 150, depositReceived: true,
    balance: 300, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: '4-month-old. Will bring extra lighting. Parents want family shots too.'
  });
  await mkOwed(b12, 'Sunita Gupta', 300, false, null, 'Balance for Baby shoot on ' + d(17));

  // 13. Aarav & Ishita Kumar — Wedding Day (July 26)
  const b13 = await mkBooking({
    clientId: aarav, clientName: 'Aarav & Ishita Kumar',
    clientEmail: 'ishita.kumar@gmail.com', clientPhone: '925-555-1313',
    type: 'Wedding (1 day)', date: d(24), time: '09:00', endTime: '23:00',
    location: 'Villa Montalvo, Saratoga CA',
    pkg: 'pkg-wedding-1d', pkgName: 'Wedding (1 Day)',
    price: 3500, deposit: 1500, depositReceived: true,
    balance: 2000, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'Hindu ceremony + Western reception. Second shooter booked.'
  });
  await mkAssistant(b13, 'Marcus Chen', 'Second Shooter', 400, false);
  await mkOwed(b13, 'Aarav & Ishita Kumar', 2000, false, null, 'Balance for Wedding (1 day) shoot on ' + d(24));

  // 14. Pooja Nair — Maternity (Aug 2)
  const b14 = await mkBooking({
    clientId: pooja, clientName: 'Pooja Nair',
    clientEmail: 'pooja.nair@gmail.com', clientPhone: '408-555-1414',
    type: 'Maternity', date: d(31), time: '17:30', endTime: '19:30',
    location: 'Shoreline at Mountain View, CA',
    pkg: 'pkg-maternity', pkgName: 'Maternity Session',
    price: 450, deposit: 150, depositReceived: false,
    balance: 450, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: '32 weeks. First time client. Referred by Anika Patel.'
  });
  await mkOwed(b14, 'Pooja Nair', 450, false, null, 'Balance for Maternity shoot on ' + d(31));

  // 15. Rhea & Vikram Choudhary — Wedding Multi-Day (Aug 16-18)
  const b15 = await mkBooking({
    clientId: rhea, clientName: 'Rhea & Vikram Choudhary',
    clientEmail: 'rhea.choudhary@gmail.com', clientPhone: '415-555-1515',
    type: 'Wedding (multi-day)', date: d(47), time: '14:00',
    location: 'Sunol Valley Golf Resort, Sunol CA',
    pkg: 'pkg-wedding-md', pkgName: 'Wedding (Multi-Day)',
    price: 5500, deposit: 2000, depositReceived: true,
    balance: 3500, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: '3-day Hindu wedding. Mehendi, Haldi, Baraat + Ceremony.'
  });
  await mkEvent(b15, 'Mehendi Night', d(45), '18:00');
  await mkEvent(b15, 'Haldi Ceremony', d(46), '10:00');
  await mkEvent(b15, 'Baraat & Wedding', d(47), '14:00');
  await mkAssistant(b15, 'Preethi Nair', 'Assistant Photographer', 500, false);
  await mkOwed(b15, 'Rhea & Vikram Choudhary', 3500, false, null, 'Balance for Wedding (multi-day) shoot on ' + d(47));

  // 16. Vivek & Ananya Joshi — Wedding (Aug 2026, follow-on from pre-wedding)
  const b16 = await mkBooking({
    clientId: vivek, clientName: 'Vivek & Ananya Joshi',
    clientEmail: 'ananya.joshi@email.com', clientPhone: '408-555-0505',
    type: 'Wedding (1 day)', date: d(58), time: '10:00', endTime: '22:00',
    location: 'Montalvo Arts Center, Saratoga CA',
    pkg: 'pkg-wedding-1d', pkgName: 'Wedding (1 Day)',
    price: 3500, deposit: 1500, depositReceived: true,
    balance: 2000, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'Follow-on from Mar 2026 pre-wedding shoot. Same venue as engagement.'
  });
  await mkAssistant(b16, 'Marcus Chen', 'Second Shooter', 400, false);
  await mkOwed(b16, 'Vivek & Ananya Joshi', 2000, false, null, 'Balance for Wedding (1 day) shoot on ' + d(58));

  // 17. Leila & Aryan Banerjee — Engagement (Sept 5, Tentative)
  const b17 = await mkBooking({
    clientId: leila, clientName: 'Leila & Aryan Banerjee',
    clientEmail: 'leila.banerjee@email.com', clientPhone: '510-555-1616',
    type: 'Engagement', date: d(65), time: '16:00', endTime: '18:00',
    location: 'Muir Woods, Mill Valley CA',
    pkg: 'pkg-engagement', pkgName: 'Engagement Session',
    price: 550, deposit: 0, depositReceived: false,
    balance: 550, status: 'Tentative', stage: 'Shoot scheduled',
    notes: 'Waiting on venue permit confirmation. Will confirm by July 20.'
  });
  await mkOwed(b17, 'Leila & Aryan Banerjee', 550, false, null, 'Balance for Engagement shoot on ' + d(65));

  // 18. Kabir & Simran Kapoor — Wedding (Oct 2026 — return client)
  const b18 = await mkBooking({
    clientId: kabir, clientName: 'Kabir & Simran Kapoor',
    clientEmail: 'simran.kapoor@gmail.com', clientPhone: '415-555-0303',
    type: 'Wedding (multi-day)', date: d(110), time: '11:00',
    location: 'The Julia Morgan Ballroom, San Francisco CA',
    pkg: 'pkg-wedding-md', pkgName: 'Wedding (Multi-Day)',
    price: 5500, deposit: 2000, depositReceived: true,
    balance: 3500, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'Return client from Jan engagement session. 3-day celebration.'
  });
  await mkEvent(b18, 'Mehndi Evening', d(108), '17:00');
  await mkEvent(b18, 'Sangeet Night',  d(109), '19:00');
  await mkEvent(b18, 'Wedding Day',    d(110), '11:00');
  await mkOwed(b18, 'Kabir & Simran Kapoor', 3500, false, null, 'Balance for Wedding (multi-day) shoot on ' + d(110));

  // 19. Tanya Khanna — Portrait (Sept 20)
  const b19 = await mkBooking({
    clientId: tanya, clientName: 'Tanya Khanna',
    clientEmail: 'tanya.khanna@gmail.com', clientPhone: '650-555-1717',
    type: 'Portrait', date: d(80), time: '10:00', endTime: '12:00',
    location: 'Stanford Campus, Palo Alto CA',
    pkg: '22487c25-b072-429d-a7c9-0b70977cb3f3', pkgName: 'Portrait Session',
    price: 350, deposit: 100, depositReceived: false,
    balance: 350, status: 'Upcoming', stage: 'Shoot scheduled',
    notes: 'MBA graduation portraits. Formal + casual looks.'
  });
  await mkOwed(b19, 'Tanya Khanna', 350, false, null, 'Balance for Portrait shoot on ' + d(80));

  // ── MANUAL MONEY OWED (misc) ────────────────────────────────────────────────
  await db.run(`INSERT INTO money_owed (id, booking_id, name, amount, notes, type, paid, paid_at)
    VALUES (?, NULL, ?, ?, ?, 'manual', 0, NULL)`,
    [uuidv4(), 'Deepak & Meera Verma', 150, 'USB drive with raw files — extra order']);

  await db.run(`INSERT INTO money_owed (id, booking_id, name, amount, notes, type, paid, paid_at)
    VALUES (?, NULL, ?, ?, ?, 'manual', 1, ?)`,
    [uuidv4(), 'Rohan & Priya Shah', 250, 'Canvas print 24x36 — anniversary gift order', '2026-01-15']);

  // ── summary ─────────────────────────────────────────────────────────────────
  const counts = {
    clients:  (await db.get('SELECT COUNT(*) as n FROM clients')).n,
    bookings: (await db.get('SELECT COUNT(*) as n FROM bookings')).n,
    owed:     (await db.get('SELECT COUNT(*) as n FROM money_owed')).n,
    events:   (await db.get('SELECT COUNT(*) as n FROM booking_events')).n,
    notes:    (await db.get('SELECT COUNT(*) as n FROM workflow_notes')).n,
  };
  console.log('Seeded:', counts);
  console.log('Done! Start the server and open the app.');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
