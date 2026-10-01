import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, Download, ImageIcon } from 'lucide-react';
import api from '../../utils/api.js';
import { formatDate } from '../../utils/helpers.js';
import GalleryLightbox, { downloadUrl } from '../../components/GalleryLightbox.jsx';

// Standalone client-facing gallery -- deliberately outside the normal site chrome (no nav/
// footer) since it's reached via a private link, not site navigation. Renders two different
// experiences off the same gallery.type: 'proofing' (pick favorites, no download) or 'final'
// (browse and download the finished photos, no favoriting).
export default function PublicGallery() {
  const { token } = useParams();
  const [gallery, setGallery] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [pending, setPending] = useState(new Set());

  const load = useCallback(() => {
    api.get(`/public/galleries/${token}`)
      .then(r => setGallery(r.data))
      .catch(err => setError(err.response?.data?.error || 'Gallery not found.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleFavorite = async (photo) => {
    if (gallery.status !== 'open' || pending.has(photo.id)) return;
    const nextFavorited = !photo.favorited;
    setPending(p => new Set(p).add(photo.id));
    // Optimistic update so hearting feels instant.
    setGallery(g => ({
      ...g,
      favorited_count: g.favorited_count + (nextFavorited ? 1 : -1),
      photos: g.photos.map(p => p.id === photo.id ? { ...p, favorited: nextFavorited } : p)
    }));
    try {
      await api.put(`/public/galleries/${token}/photos/${photo.id}`, { favorited: nextFavorited });
    } catch {
      load(); // roll back to server truth on failure
    } finally {
      setPending(p => { const next = new Set(p); next.delete(photo.id); return next; });
    }
  };

  const downloadAll = () => {
    // Sequential triggers so the browser treats each as its own user-gesture-initiated download
    // rather than a single burst that popup/download blockers might swallow.
    gallery.photos.forEach((p, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = downloadUrl(p.url);
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 300);
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-ink-faint">Loading…</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ImageIcon className="w-8 h-8 text-ink-faint mx-auto mb-3" />
          <p className="text-ink-soft">{error}</p>
        </div>
      </div>
    );
  }

  const isProofing = gallery.type === 'proofing';
  // A null extra_photo_price means this package (e.g. weddings) never charges for extra picks --
  // must gate on that before touching the count/price math, not just on favorited > included.
  const chargesApply = gallery.extra_photo_price != null;
  const extraCount = chargesApply ? Math.max(0, gallery.favorited_count - (gallery.included_photo_count || 0)) : 0;

  return (
    <div className="min-h-screen bg-paper">
      <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl">{gallery.title}</h1>
            <p className="text-sm text-ink-soft mt-1">
              {gallery.client_name}{gallery.shoot_type ? ` · ${gallery.shoot_type}` : ''}{gallery.shoot_date ? ` · ${formatDate(gallery.shoot_date)}` : ''}
            </p>
          </div>
          {!isProofing && gallery.photos.length > 0 && (
            <button onClick={downloadAll}
              className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded">
              <Download className="w-4 h-4" /> Download All
            </button>
          )}
        </div>

        {isProofing && (
          <div className="border border-line rounded-md p-4 bg-paper-raised mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Heart className="w-4 h-4 text-accent fill-accent" />
              <span className="font-semibold">{gallery.favorited_count}</span>
              <span className="text-ink-faint">favorited{gallery.included_photo_count ? ` · ${gallery.included_photo_count} included in your package` : ''}</span>
            </div>
            {extraCount > 0 && (
              <p className="text-xs text-ink-faint">
                {extraCount} beyond what's included (${gallery.extra_photo_price.toFixed(2)} each) — your photographer will follow up with the total.
              </p>
            )}
          </div>
        )}

        {isProofing && gallery.status !== 'open' && (
          <p className="text-sm bg-paper-sunken border border-line rounded px-3 py-2 mb-6 text-ink-soft">
            Your picks are locked in — your photographer is working on these now.
          </p>
        )}

        {gallery.photos.length === 0 ? (
          <p className="text-ink-faint text-center py-16">No photos uploaded yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gallery.photos.map((p, i) => (
              <div key={p.id} className="relative aspect-square rounded-md overflow-hidden bg-paper-sunken group">
                <button onClick={() => setLightboxIndex(i)} className="w-full h-full">
                  <img src={p.thumbnail_url || p.url} alt="" className="w-full h-full object-cover" />
                </button>
                {isProofing ? (
                  <button
                    onClick={() => toggleFavorite(p)}
                    disabled={gallery.status !== 'open'}
                    data-testid="heart-toggle"
                    aria-label={p.favorited ? 'Remove favorite' : 'Mark as favorite'}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm disabled:opacity-70 disabled:cursor-default transition-transform active:scale-90">
                    <Heart className={`w-4 h-4 ${p.favorited ? 'text-accent fill-accent' : 'text-ink-faint'}`} />
                  </button>
                ) : (
                  <a
                    href={downloadUrl(p.url)}
                    download
                    onClick={e => e.stopPropagation()}
                    aria-label="Download photo"
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download className="w-4 h-4 text-ink" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={gallery.photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          mode={isProofing ? 'favorite' : 'download'}
          onToggleFavorite={toggleFavorite}
          favoriteDisabled={gallery.status !== 'open'}
        />
      )}
    </div>
  );
}
