// Thin entry point for Vercel's zero-config serverless function detection (any file under /api
// becomes a function automatically). Re-exports the real Express app unchanged -- vercel.json's
// rewrite sends every /api/* request here, and Express sees the original full path via req.url
// to do its own internal routing, same as it does locally.
module.exports = require('../server/src/index.js');
