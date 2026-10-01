import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Heart, Plus, Trash2, Copy, Check, Lock, Unlock, DollarSign, Download } from 'lucide-react';
import api from '../utils/api.js';
import { formatCurrency } from '../utils/helpers.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import { downloadUrl } from './GalleryLightbox.jsx';
import toast from 'react-hot-toast';

const COPY = {
  proofing: {
    title: 'Proofing Gallery',
    createLabel: 'Create proofing gallery',
    createdToast: 'Proofing gallery created',
  },
  final: {
    title: 'Final Photos',
    createLabel: 'Create final photo gallery',
    createdToast: 'Final gallery created',
  },
};

// Client gallery for a single booking. `type` picks which flavor: 'proofing' (upload proofs,
// watch which ones the client hearts, turn extra picks into a money-owed line) or 'final'
// (upload finished edits, client browses and downloads them -- no favoriting, no download lock).
export default function GalleryCard({ bookingId, type }) {
  const copy = COPY[type];
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingCost, setAddingCost] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [includedCount, setIncludedCount] = useState(0);
  // '' represents "no extra-photo charge" (null on the server) -- kept distinct from 0, which
  // would mean "extras are tracked but free." Only relevant for non-wedding packages.
  const [extraPrice, setExtraPrice] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/galleries?booking_id=${bookingId}&type=${type}`);
      const g = res.data[0] || null;
      setGallery(g);
      if (g) { setIncludedCount(g.included_photo_count); setExtraPrice(g.extra_photo_price ?? ''); }
    } catch { /* no gallery yet */ }
    setLoading(false);
  }, [bookingId, type]);

  useEffect(() => { load(); }, [load]);

  const createGallery = async () => {
    try {
      const res = await api.post('/galleries', { booking_id: bookingId, type });
      setGallery(res.data);
      setIncludedCount(res.data.included_photo_count);
      setExtraPrice(res.data.extra_photo_price ?? '');
      toast.success(copy.createdToast);
    } catch { toast.error('Failed to create gallery'); }
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    let succeeded = 0;
    for (const file of files) {
      try {
        const uploaded = await uploadToCloudinary(file, `/galleries/${gallery.id}/sign`);
        await api.post(`/galleries/${gallery.id}/photos`, {
          url: uploaded.url, public_id: uploaded.public_id, resource_type: uploaded.resource_type
        });
        succeeded++;
      } catch { /* keep going with the rest */ }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (succeeded > 0) toast.success(`Uploaded ${succeeded} photo${succeeded !== 1 ? 's' : ''}`);
    if (succeeded < files.length) toast.error(`${files.length - succeeded} upload(s) failed`);
    load();
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm('Remove this photo from the gallery? This cannot be undone.')) return;
    try {
      await api.delete(`/galleries/${gallery.id}/photos/${photoId}`);
      toast.success('Photo removed');
      load();
    } catch { toast.error('Failed to remove photo'); }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/gallery/${gallery.access_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Gallery link copied');
  };

  const toggleStatus = async () => {
    const nextStatus = gallery.status === 'open' ? 'closed' : 'open';
    try {
      const res = await api.put(`/galleries/${gallery.id}`, { status: nextStatus });
      setGallery(res.data);
      toast.success(nextStatus === 'closed' ? 'Picks locked in' : 'Reopened for client picks');
    } catch { toast.error('Failed to update'); }
  };

  const saveSettings = async () => {
    try {
      const res = await api.put(`/galleries/${gallery.id}`, {
        included_photo_count: parseInt(includedCount) || 0,
        extra_photo_price: extraPrice === '' ? null : (parseFloat(extraPrice) || 0)
      });
      setGallery(res.data);
      setEditingSettings(false);
      toast.success('Updated');
    } catch { toast.error('Failed to update'); }
  };

  const addExtraCostToMoneyOwed = async () => {
    // Deliberately NOT linked to booking_id: the "pay" action for a booking-linked money_owed
    // row zeroes that booking's balance_due outright, which is correct for the original
    // shoot-balance row but would be wrong here -- this is an additional, separate charge.
    setAddingCost(true);
    try {
      await api.post('/money-owed', {
        name: `${gallery.title} — extra photos`,
        amount: gallery.extra_photo_cost,
        notes: `${gallery.extra_photo_count} extra photo(s) beyond the ${gallery.included_photo_count} included`
      });
      toast.success('Added to Money Owed');
    } catch { toast.error('Failed to add'); }
    setAddingCost(false);
  };

  if (loading) return null;
  const isProofing = type === 'proofing';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm dark:text-white">{copy.title}</h2>
        {gallery && isProofing && (
          <button onClick={toggleStatus}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
            {gallery.status === 'open' ? <><Unlock className="w-3 h-3" /> Open for picks</> : <><Lock className="w-3 h-3" /> Picks locked</>}
          </button>
        )}
      </div>

      {!gallery ? (
        <button onClick={createGallery}
          className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> {copy.createLabel}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input readOnly value={`${window.location.origin}/gallery/${gallery.access_token}`}
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 dark:text-gray-300 font-mono" />
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {isProofing && (
            <>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span className="dark:text-white font-medium">{gallery.favorited_count}</span>
                  <span className="text-gray-400">favorited · {gallery.included_photo_count} included</span>
                </div>
                {!editingSettings && (
                  <button onClick={() => setEditingSettings(true)} className="text-xs text-sky-600 hover:underline">Edit</button>
                )}
              </div>

              {editingSettings && (
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Included photos</label>
                    <input type="number" min="0" value={includedCount} onChange={e => setIncludedCount(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Price per extra</label>
                    <input type="number" min="0" step="0.01" value={extraPrice} onChange={e => setExtraPrice(e.target.value)}
                      placeholder="No charge"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
                  </div>
                  <p className="col-span-2 text-xs text-gray-400 -mt-1">Leave price blank for no extra-photo charge.</p>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => setEditingSettings(false)} className="flex-1 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs dark:text-white">Cancel</button>
                    <button onClick={saveSettings} className="flex-1 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-medium">Save</button>
                  </div>
                </div>
              )}

              {gallery.extra_photo_count > 0 && (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {gallery.extra_photo_count} extra photo{gallery.extra_photo_count !== 1 ? 's' : ''} picked
                    </p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(gallery.extra_photo_cost)}</p>
                  </div>
                  <button onClick={addExtraCostToMoneyOwed} disabled={addingCost}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    <DollarSign className="w-3.5 h-3.5" /> Add to Money Owed
                  </button>
                </div>
              )}
            </>
          )}

          {!isProofing && gallery.photos.length > 0 && (
            <p className="text-xs text-gray-400">Clients can view and download every photo below from the link above.</p>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {gallery.photos.map(p => (
              <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                {isProofing && !!p.favorited && (
                  <div className="absolute top-1 left-1 bg-white/90 rounded-full p-1">
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  </div>
                )}
                {!isProofing && (
                  <a href={downloadUrl(p.url)} download aria-label="Download photo"
                    className="absolute top-1 left-1 bg-white/90 rounded-full p-1 opacity-70 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <Download className="w-3 h-3 text-gray-700" />
                  </a>
                )}
                <button onClick={() => deletePhoto(p.id)} aria-label="Remove photo"
                  className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-70 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer transition-colors">
              {uploading ? (
                <span className="text-xs">Uploading…</span>
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
