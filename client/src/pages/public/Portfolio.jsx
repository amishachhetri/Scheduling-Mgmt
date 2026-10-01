import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PlaceholderPhoto from '../../components/public/PlaceholderPhoto.jsx';

const FILTERS = ['All', 'Weddings', 'Portraits', 'Milestones'];

// Placeholder entries shown until real photos are uploaded from the admin Portfolio tab.
const PLACEHOLDER_ITEMS = [
  { category: 'Weddings', title: 'Riverside Ceremony', aspect: 'aspect-[4/5]' },
  { category: 'Portraits', title: 'Golden Hour Engagement', aspect: 'aspect-square' },
  { category: 'Weddings', title: 'Garden Reception', aspect: 'aspect-[3/4]' },
  { category: 'Milestones', title: 'First Birthday', aspect: 'aspect-square' },
  { category: 'Portraits', title: 'Maternity, Botanical Gardens', aspect: 'aspect-[4/5]' },
  { category: 'Weddings', title: 'Vineyard Vows', aspect: 'aspect-[3/4]' },
  { category: 'Portraits', title: 'Newborn, Studio Light', aspect: 'aspect-square' },
  { category: 'Milestones', title: 'Proposal at Sunset', aspect: 'aspect-[4/5]' },
  { category: 'Weddings', title: 'Downtown Loft Wedding', aspect: 'aspect-square' },
  { category: 'Portraits', title: 'Pre-Wedding Session', aspect: 'aspect-[3/4]' },
  { category: 'Milestones', title: 'Second Birthday Party', aspect: 'aspect-[4/5]' },
  { category: 'Weddings', title: 'Beachside Ceremony', aspect: 'aspect-square' }
];

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [photos, setPhotos] = useState(null);

  useEffect(() => {
    api.get('/public/media?type=photo').then(r => setPhotos(r.data)).catch(() => setPhotos([]));
  }, []);

  const usingPlaceholders = photos !== null && photos.length === 0;
  const source = usingPlaceholders ? PLACEHOLDER_ITEMS : (photos || []);

  const items = useMemo(
    () => (filter === 'All' ? source : source.filter(i => i.category === filter)),
    [filter, source]
  );

  return (
    <div className="px-6 md:px-10 py-12 max-w-6xl mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-accent">Recent work</div>
      <h1 className="font-display text-3xl mt-2">Portfolio</h1>
      <p className="text-ink-soft mt-3 max-w-xl leading-relaxed">
        {usingPlaceholders
          ? 'A look at recent sessions. Photos below are placeholders — real work goes here once the gallery is ready.'
          : 'A look at recent sessions.'}
      </p>

      <div className="flex gap-2 mt-7 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-ink text-paper border-ink' : 'border-line-strong text-ink-soft hover:text-ink hover:border-ink'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="columns-2 md:columns-3 gap-4 mt-8 [column-fill:_balance]">
        {usingPlaceholders ? items.map((item, i) => (
          <div key={i} className="break-inside-avoid mb-4 group">
            <PlaceholderPhoto aspect={item.aspect} tag={item.category} iconClassName="w-8 h-8" className="transition-transform group-hover:scale-[1.01]" />
            <p className="text-sm mt-2 text-ink-soft">{item.title}</p>
          </div>
        )) : items.map(item => (
          <div key={item.id} className="break-inside-avoid mb-4 group">
            <img src={item.url} alt={item.title || ''} className="w-full rounded-md transition-transform group-hover:scale-[1.01]" />
            {item.title && <p className="text-sm mt-2 text-ink-soft">{item.title}</p>}
          </div>
        ))}
      </div>

      <div className="text-center mt-14 py-10 border-t border-line">
        <h2 className="font-display text-2xl">Like what you see?</h2>
        <Link to="/book" className="inline-block mt-5 bg-accent text-white text-sm font-semibold px-6 py-3 rounded">
          Check Availability
        </Link>
      </div>
    </div>
  );
}
