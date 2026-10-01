import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api.js';
import PlaceholderPhoto from '../../components/public/PlaceholderPhoto.jsx';

const PILLARS = [
  { title: 'Candid', body: 'I stay out of the way so the day unfolds naturally — the best moments happen when no one is posing for a camera.' },
  { title: 'Personal', body: "Every session starts with a conversation. I want to know your story before I ever pick up a camera." },
  { title: 'Timeless', body: 'Editing that ages well — true colors, real light, nothing trendy you\'ll want to redo in five years.' }
];

const DEFAULT_BIO = `I've spent years photographing weddings, growing families, and the small milestones in between. What started as a way to hold onto moments for my own family turned into a full-time craft — and I still get the same rush watching a scene come together through the lens.

My style leans candid and light-driven: real laughter over stiff poses, golden hour over studio flash whenever the sky cooperates. Every gallery is edited by hand, one photo at a time — no presets, no shortcuts.`;

export default function About() {
  const [profile, setProfile] = useState({ name: '', bio: '', avatar_url: '' });

  useEffect(() => {
    api.get('/public/profile').then(r => setProfile(p => ({ ...p, ...r.data }))).catch(() => {});
  }, []);

  const paragraphs = (profile.bio?.trim() || DEFAULT_BIO).split(/\n\s*\n/);

  return (
    <div>
      <section className="px-6 md:px-10 pt-14 pb-4 grid md:grid-cols-[1fr_1.2fr] gap-11 max-w-5xl mx-auto items-start">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.name || 'Portrait'} className="aspect-[4/5] w-full object-cover rounded-md" />
        ) : (
          <PlaceholderPhoto aspect="aspect-[4/5]" label="Portrait placeholder" iconClassName="w-12 h-12" />
        )}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-accent">About</div>
          <h1 className="font-display text-3xl mt-2">
            {profile.name ? `Hi, I'm ${profile.name}` : 'The person behind the camera'}
          </h1>
          {paragraphs.map((p, i) => (
            <p key={i} className="text-ink-soft mt-4 leading-relaxed">{p}</p>
          ))}
          <Link to="/book" className="inline-block mt-6 bg-accent text-white text-sm font-semibold px-5 py-3 rounded">
            Let's work together
          </Link>
        </div>
      </section>

      <section className="px-6 md:px-10 py-14 max-w-5xl mx-auto">
        <h2 className="font-display text-2xl text-center">How I work</h2>
        <div className="grid sm:grid-cols-3 gap-7 mt-8">
          {PILLARS.map(p => (
            <div key={p.title} className="border border-line rounded-md p-5 bg-paper-raised">
              <div className="font-display text-lg">{p.title}</div>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
