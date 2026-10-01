const crypto = require('crypto');

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Cloudinary signs uploads by taking every param except file/api_key/signature/resource_type,
// sorting them alphabetically, joining as key=value pairs, and SHA-1 hashing with the secret
// appended. This mirrors what the official SDK does, without adding it as a dependency.
function signParams(params) {
  const toSign = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + process.env.CLOUDINARY_API_SECRET).digest('hex');
}

function signUpload(extraParams = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, ...extraParams };
  const signature = signParams(paramsToSign);
  return {
    timestamp,
    signature,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    ...extraParams
  };
}

async function deleteAsset(publicId, resourceType = 'image') {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ public_id: publicId, timestamp });
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: process.env.CLOUDINARY_API_KEY,
    signature
  });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    { method: 'POST', body }
  );
  if (!res.ok) throw new Error(`Cloudinary delete failed: ${res.status}`);
  return res.json();
}

// Standard Cloudinary pattern for grabbing a still frame from a video as its thumbnail.
function videoThumbnailUrl(publicId) {
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_0,w_800,c_fill/${publicId}.jpg`;
}

module.exports = { isConfigured, signUpload, deleteAsset, videoThumbnailUrl };
