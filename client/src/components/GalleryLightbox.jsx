import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Download } from 'lucide-react';

// Cloudinary forces a download response (rather than opening inline) when `fl_attachment` is
// inserted right after `/upload/` in the delivery URL -- no server-side work needed.
export function downloadUrl(url) {
  return url.includes('/upload/') ? url.replace('/upload/', '/upload/fl_attachment/') : url;
}

// Shared full-screen photo viewer with arrow/keyboard navigation, used by both the admin
// gallery card and the public client-facing gallery page. `mode` controls what action is
// offered at the bottom: 'favorite' (proofing) or 'download' (final) or none.
export default function GalleryLightbox({ photos, index, onClose, onNavigate, mode, onToggleFavorite, favoriteDisabled }) {
  const photo = photos[index];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length);
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % photos.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, photos.length, onClose, onNavigate]);

  if (!photo) return null;
  const hasMultiple = photos.length > 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-white/80 hover:text-white">
        <X className="w-6 h-6" />
      </button>

      {hasMultiple && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onNavigate((index - 1 + photos.length) % photos.length); }}
            aria-label="Previous photo"
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onNavigate((index + 1) % photos.length); }}
            aria-label="Next photo"
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <img src={photo.url} alt="" className="max-w-full max-h-[85vh] object-contain" onClick={e => e.stopPropagation()} />

      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
          {index + 1} / {photos.length}
        </div>
      )}

      {mode === 'favorite' && (
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(photo); }}
          disabled={favoriteDisabled}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/95 hover:bg-white rounded-full p-3 shadow-lg disabled:opacity-70">
          <Heart className={`w-6 h-6 ${photo.favorited ? 'text-accent fill-accent' : 'text-ink-faint'}`} />
        </button>
      )}

      {mode === 'download' && (
        <a
          href={downloadUrl(photo.url)}
          download
          onClick={e => e.stopPropagation()}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 hover:bg-white rounded-full px-4 py-3 shadow-lg text-sm font-medium text-ink">
          <Download className="w-5 h-5" /> Download
        </a>
      )}
    </div>
  );
}
