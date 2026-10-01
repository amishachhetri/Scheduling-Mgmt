const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { db, NOW_TS } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { hashToken, verifyPassword } = require('../middleware/adminAuth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (!(await verifyPassword(password))) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
  await db.run(`
    INSERT INTO admin_sessions (id, token_hash, expires_at)
    VALUES (?, ?, TO_CHAR((NOW() AT TIME ZONE 'UTC') + INTERVAL '90 days', 'YYYY-MM-DD HH24:MI:SS'))
  `, [uuidv4(), hashToken(sessionToken)]);

  res.cookie('admin_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs
  });
  res.json({ success: true });
});

router.get('/session', async (req, res) => {
  const raw = req.cookies?.admin_session;
  if (!raw) return res.status(401).json({ authenticated: false });

  const session = await db.get(
    `SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ${NOW_TS}`, [hashToken(raw)]
  );
  if (!session) return res.status(401).json({ authenticated: false });

  res.json({ authenticated: true });
});

router.post('/logout', async (req, res) => {
  const raw = req.cookies?.admin_session;
  if (raw) {
    await db.run('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(raw)]);
  }
  res.clearCookie('admin_session');
  res.json({ success: true });
});

module.exports = router;
