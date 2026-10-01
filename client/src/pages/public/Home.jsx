import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PlaceholderPhoto from '../../components/public/PlaceholderPhoto.jsx';
import FAQAccordion from '../../components/public/FAQAccordion.jsx';

const CATEGORY_ORDER = ['Weddings', 'Portraits', 'Milestones'];
const CATEGORY_MAP = {
  'Wedding (1 day)': 'Weddings',
  'Wedding (multi-day)': 'Weddings',
  'Engagement': 'Portraits',
  'Maternity': 'Portraits',
  'Baby': 'Portraits',
  'Pre-wedding': 'Portraits',
  'Post-wedding': 'Portraits',
  'Proposal': 'Milestones',
  'Birthday': 'Milestones'
};

const RECENT_WORK = [
  { category: 'Weddings', title: 'Riverside Ceremony' },
  { category: 'Portraits', title: 'Golden Hour Engagement' },
  { category: 'Milestones', title: 'First Birthday' },
  { category: 'Weddings', title: 'Vineyard Vows' }
];

const TESTIMONIALS = [
  {
    quote: "We cannot possibly thank you enough for accepting our request at the last minute, knowing you were already booked that day. You went above and beyond to capture every detail of our big day — a true pleasure to work with.",
    name: 'Sangam & Deuka',
    type: 'Wedding'
  },
  {
    quote: "We're both very private people, but sharing those special moments with you felt right — trusting your professional judgement was one of the best decisions we made for our wedding.",
    name: 'Vishnu & Sumitra',
    type: 'Wedding'
  },
  {
    quote: "You guys did such an amazing job at our wedding and captured so many beautiful moments we'll cherish forever. You were so easy to work with, made us feel comfortable, and put so much effort into everything.",
    name: 'Manisha & Binod',
    type: 'Wedding'
  }
];

const FAQS = [
  { q: 'How does booking actually work?', a: "You submit a request with your preferred date and package — it's not confirmed yet. It goes straight into the queue for review, and you'll get an email as soon as it's approved, usually within a couple of days." },
  { q: 'How far in advance should I book?', a: "For weddings, 3–6 months ahead is ideal, especially for peak season. Portrait and milestone sessions can often be booked with just a couple of weeks' notice." },
  { q: 'Is a deposit required?', a: 'Most packages require a deposit to hold your date once your request is approved — the exact amount depends on the session and will be confirmed with you directly.' },
  { q: 'Can I reschedule if something comes up?', a: "Life happens — reach out as soon as you know and we'll find a new date together, availability permitting." },
  { q: 'How long until I get my photos?', a: "Turnaround varies by session type, but you'll always get a shareable gallery link the moment your photos are ready." }
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [allPhotos, setAllPhotos] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const featuredPhotos = allPhotos.filter(m => m.featured).slice(0, 4);

  useEffect(() => {
    api.get('/public/packages').then(r => {
      const byCategory = {};
      for (const pkg of r.data) {
        const cat = CATEGORY_MAP[pkg.shoot_type] || 'Sessions';
        if (!byCategory[cat] || pkg.price < byCategory[cat]) byCategory[cat] = pkg.price;
      }
      const ordered = CATEGORY_ORDER.filter(c => byCategory[c] !== undefined)
        .map(c => ({ name: c, from: byCategory[c] }));
      setCategories(ordered);
    }).catch(() => {});
    api.get('/public/profile').then(r => setCoverPhotoUrl(r.data?.cover_photo_url || '')).catch(() => {});
    api.get('/public/media?type=photo').then(r => setAllPhotos(r.data)).catch(() => {});
  }, []);

  // Hero rotates through the portfolio every 5s once there's more than one photo to show --
  // falls back to the static cover photo (then a placeholder) when the portfolio is empty.
  useEffect(() => {
    if (allPhotos.length < 2) return;
    const id = setInterval(() => setHeroIndex(i => (i + 1) % allPhotos.length), 5000);
    return () => clearInterval(id);
  }, [allPhotos.length]);

  return (
    <div>
      <section className="px-6 md:px-10 pt-16 pb-11 grid md:grid-cols-[1.1fr_1fr] gap-11 items-center max-w-6xl mx-auto">
        <div>
          <h1 className="font-display text-4xl md:text-5xl leading-tight" style={{ textWrap: 'balance' }}>
            Your story, in focus.
          </h1>
          <p className="text-ink-soft mt-4 max-w-md leading-relaxed">
            Weddings, portraits, and milestone sessions — pick your date, tell us the details, and we'll take it from there.
          </p>
          <div className="flex gap-3 mt-7">
            <Link to="/book" className="bg-accent text-white text-sm font-semibold px-5 py-3 rounded">Check Availability</Link>
            <Link to="/packages" className="border border-line-strong text-ink text-sm font-semibold px-5 py-3 rounded">See Packages</Link>
          </div>
        </div>
        {allPhotos.length > 0 ? (
          <div className="aspect-[4/5] w-full relative rounded-md overflow-hidden">
            {allPhotos.map((p, i) => (
              <img key={p.id} src={p.url} alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ${i === heroIndex ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
        ) : coverPhotoUrl ? (
          <img src={coverPhotoUrl} alt="" className="aspect-[4/5] w-full object-cover rounded-md" />
        ) : (
          <PlaceholderPhoto aspect="aspect-[4/5]" iconClassName="w-16 h-16" label="Photo placeholder — hero image" />
        )}
      </section>

      {categories.length > 0 && (
        <section className="grid sm:grid-cols-3 border-y border-line divide-y sm:divide-y-0 sm:divide-x divide-line">
          {categories.map(c => (
            <Link key={c.name} to="/packages" className="px-6 md:px-8 py-6 hover:bg-paper-raised transition-colors block">
              <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">{c.name}</div>
              <div className="font-display text-lg mt-1.5">Starting at ${c.from.toLocaleString()}</div>
            </Link>
          ))}
        </section>
      )}

      <section className="px-6 md:px-10 py-14 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-7 flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-accent">Recent work</div>
            <h2 className="font-display text-2xl mt-1.5">A few favorites</h2>
          </div>
          <Link to="/portfolio" className="text-sm text-accent font-semibold hover:underline">View full portfolio →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featuredPhotos.length > 0 ? featuredPhotos.map(item => (
            <Link key={item.id} to="/portfolio" className="block group">
              <img src={item.url} alt={item.title || ''} className="aspect-square w-full object-cover rounded-md transition-transform group-hover:scale-[1.02]" />
              {item.title && <p className="text-sm mt-2 text-ink-soft">{item.title}</p>}
            </Link>
          )) : RECENT_WORK.map((item, i) => (
            <Link key={i} to="/portfolio" className="block group">
              <PlaceholderPhoto aspect="aspect-square" tag={item.category} iconClassName="w-8 h-8" className="transition-transform group-hover:scale-[1.02]" />
              <p className="text-sm mt-2 text-ink-soft">{item.title}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-10 py-14 max-w-4xl mx-auto text-center">
        <h2 className="font-display text-2xl">How booking works</h2>
        <div className="grid sm:grid-cols-3 gap-7 mt-8 text-left sm:text-center">
          <div>
            <div className="font-mono text-xs text-accent font-bold">01</div>
            <div className="font-display text-lg mt-2">You request a date</div>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">Pick a package and an open slot — takes about two minutes.</p>
          </div>
          <div>
            <div className="font-mono text-xs text-accent font-bold">02</div>
            <div className="font-display text-lg mt-2">We confirm it</div>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">Your date is held while it's reviewed, usually within a couple of days.</p>
          </div>
          <div>
            <div className="font-mono text-xs text-accent font-bold">03</div>
            <div className="font-display text-lg mt-2">You're booked</div>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">You'll get a confirmation email — no calls, no back-and-forth needed.</p>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-14 bg-paper-raised border-y border-line">
        <div className="max-w-6xl mx-auto">
          <div className="text-[11px] uppercase tracking-wider text-accent text-center">Kind words</div>
          <h2 className="font-display text-2xl mt-1.5 text-center">From recent clients</h2>
          <p className="text-ink-soft text-sm text-center max-w-lg mx-auto mt-3 leading-relaxed">
            I've had the privilege of working with some of the nicest, kindest people — it's what makes this work so enjoyable. Here's what a few of them had to say.
          </p>
          <div className="grid md:grid-cols-3 gap-5 mt-9">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-paper border border-line rounded-md p-5 flex flex-col">
                <p className="text-sm text-ink leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 pt-3 border-t border-line">
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-ink-faint">{t.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-14 max-w-3xl mx-auto">
        <div className="text-[11px] uppercase tracking-wider text-accent text-center">Questions</div>
        <h2 className="font-display text-2xl mt-1.5 text-center">Frequently asked</h2>
        <FAQAccordion items={FAQS} className="mt-8" />
      </section>

      <section className="px-6 md:px-10 py-16 text-center border-t border-line">
        <h2 className="font-display text-3xl" style={{ textWrap: 'balance' }}>Ready to book your session?</h2>
        <p className="text-ink-soft mt-3">Check available dates and send your request in a couple of minutes.</p>
        <Link to="/book" className="inline-block mt-6 bg-accent text-white text-sm font-semibold px-6 py-3 rounded">
          Check Availability
        </Link>
      </section>
    </div>
  );
}
