const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { hashToken, verifyPassword } = require('../middleware/adminAuth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (!verifyPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
  db.prepare(`
    INSERT INTO admin_sessions (id, token_hash, expires_at)
    VALUES (?, ?, datetime('now', '+90 days'))
  `).run(uuidv4(), hashToken(sessionToken));

  res.cookie('admin_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs
  });
  res.json({ success: true });
});

router.get('/session', (req, res) => {
  const raw = req.cookies?.admin_session;
  if (!raw) return res.status(401).json({ authenticated: false });

  const session = db.prepare(
    "SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > datetime('now')"
  ).get(hashToken(raw));
  if (!session) return res.status(401).json({ authenticated: false });

  res.json({ authenticated: true });
});

router.post('/logout', (req, res) => {
  const raw = req.cookies?.admin_session;
  if (raw) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(raw));
  }
  res.clearCookie('admin_session');
  res.json({ success: true });
});

module.exports = router;
