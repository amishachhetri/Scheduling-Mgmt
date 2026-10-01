import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import api from '../../utils/api.js';
import ApertureMark from '../../components/public/ApertureMark.jsx';

export default function Reels() {
  const [videos, setVideos] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    api.get('/public/media?type=video').then(r => setVideos(r.data)).catch(() => setVideos([]));
  }, []);

  return (
    <div className="px-6 md:px-10 py-12 max-w-6xl mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-accent">Motion</div>
      <h1 className="font-display text-3xl mt-2">Reels</h1>
      <p className="text-ink-soft mt-3 max-w-xl leading-relaxed">
        Short highlight films from recent sessions.
      </p>

      {videos === null ? null : videos.length === 0 ? (
        <div className="mt-14 py-16 border border-dashed border-line-strong rounded-md text-center">
          <ApertureMark className="w-10 h-10 mx-auto text-ink opacity-40" />
          <p className="text-ink-faint mt-3 text-sm">No reels posted yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
          {videos.map(v => (
            <div key={v.id} className="aspect-[9/16] rounded-md overflow-hidden bg-paper-sunken relative group">
              {playingId === v.id ? (
                <video src={v.url} controls autoPlay className="w-full h-full object-cover" onEnded={() => setPlayingId(null)} />
              ) : (
                <button onClick={() => setPlayingId(v.id)} className="w-full h-full block relative" aria-label={`Play ${v.title || 'reel'}`}>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title || ''} className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ApertureMark className="w-8 h-8 text-ink opacity-30" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <span className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-4 h-4 text-ink ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                  {v.title && (
                    <span className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium drop-shadow">{v.title}</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-14 py-10 border-t border-line">
        <h2 className="font-display text-2xl">Like what you see?</h2>
        <Link to="/book" className="inline-block mt-5 bg-accent text-white text-sm font-semibold px-6 py-3 rounded">
          Check Availability
        </Link>
      </div>
    </div>
  );
}
