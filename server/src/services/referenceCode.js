const crypto = require('crypto');
const { db } = require('../db/schema');

function generateReferenceCode() {
  return 'F-' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

// Retries on the rare collision -- backed by the UNIQUE index on bookings.reference_code, so two
// callers racing each other still can't both walk away with the same code.
function generateUniqueReferenceCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateReferenceCode();
    const exists = db.prepare('SELECT 1 FROM bookings WHERE reference_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique reference code');
}

module.exports = { generateReferenceCode, generateUniqueReferenceCode };
