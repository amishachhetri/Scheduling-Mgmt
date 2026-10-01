import api from './api.js';

// Direct-to-Cloudinary upload: our server only ever hands out a short-lived signature,
// the actual file bytes go straight from the browser to Cloudinary and never touch our server.
// `signUrl` lets callers (e.g. gallery uploads) get a signature scoped to a different folder
// than the default portfolio one.
export async function uploadToCloudinary(file, signUrl = '/media/sign') {
  const { data: sign } = await api.get(signUrl);

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.api_key);
  form.append('timestamp', sign.timestamp);
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloud_name}/auto/upload`, {
    method: 'POST',
    body: form
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || 'Upload failed');
  }
  const uploaded = await res.json();
  return {
    url: uploaded.secure_url,
    public_id: uploaded.public_id,
    resource_type: uploaded.resource_type,
    type: uploaded.resource_type === 'video' ? 'video' : 'photo'
  };
}
