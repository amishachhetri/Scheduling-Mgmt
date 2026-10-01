const crypto = require('crypto');
const { db } = require('../db/schema');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Verifies a plaintext password attempt against the scrypt hash in ADMIN_PASSWORD_HASH
// (format "salt:hash", both hex). Timing-safe so failed attempts can't be used to guess bytes.
function verifyPassword(attempt) {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || !attempt) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attemptHash = crypto.scryptSync(attempt, salt, 64);
  const storedHash = Buffer.from(hash, 'hex');
  if (attemptHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(attemptHash, storedHash);
}

// Protects admin routes with the session cookie set by /api/admin/auth/verify.
function adminAuth(req, res, next) {
  const raw = req.cookies?.admin_session;
  if (!raw) return res.status(401).json({ error: 'Unauthorized' });

  const tokenHash = hashToken(raw);
  const session = db.prepare(
    "SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > datetime('now')"
  ).get(tokenHash);

  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  // Throttle last_seen_at updates to roughly once per hour to avoid a write on every request.
  if (new Date(session.last_seen_at) < new Date(Date.now() - 60 * 60 * 1000)) {
    db.prepare("UPDATE admin_sessions SET last_seen_at = datetime('now') WHERE id = ?").run(session.id);
  }

  req.admin = { sessionId: session.id };
  next();
}

module.exports = { adminAuth, hashToken, verifyPassword };
