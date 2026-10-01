import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api.js';

const CATEGORY_ORDER = ['Weddings', 'Portraits', 'Milestones', 'Sessions'];
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

export default function Packages() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/packages').then(r => {
      const byCategory = {};
      for (const pkg of r.data) {
        const cat = CATEGORY_MAP[pkg.shoot_type] || 'Sessions';
        (byCategory[cat] ||= []).push(pkg);
      }
      const ordered = CATEGORY_ORDER
        .filter(c => byCategory[c])
        .map(c => ({ name: c, packages: byCategory[c] }));
      setGroups(ordered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 md:px-10 py-12 max-w-5xl mx-auto">
      <div className="text-[11px] uppercase tracking-wider text-accent">Sessions &amp; pricing</div>
      <h1 className="font-display text-3xl mt-2">Find your fit</h1>

      {loading ? (
        <p className="text-ink-faint mt-8">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-ink-faint mt-8">No packages available right now — check back soon.</p>
      ) : groups.map(group => (
        <div key={group.name} className="mt-9">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint border-b border-line pb-2.5 mb-4">{group.name}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.packages.map(pkg => (
              <div key={pkg.id} className="border border-line rounded-md p-5 bg-paper-raised flex flex-col gap-2.5">
                <div className="font-display text-lg">{pkg.name}</div>
                <p className="text-sm text-ink-soft leading-relaxed flex-1">{pkg.description}</p>
                <div className="font-mono text-xl pt-1 border-t border-line">{pkg.shoot_type?.toLowerCase().includes('multi-day') ? 'Starting at ' : ''}${pkg.price.toLocaleString()}</div>
                <button onClick={() => navigate(`/book?package=${pkg.id}`)}
                  className="bg-accent text-white text-sm font-semibold py-2.5 rounded mt-1">
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-14 border border-dashed border-line-strong rounded-md p-6 text-center">
        <div className="font-display text-xl">Don't see what you need?</div>
        <p className="text-sm text-ink-soft mt-1.5 max-w-md mx-auto leading-relaxed">
          Tell us what you have in mind — a different kind of session, a custom package, anything —
          and we'll follow up with a quote.
        </p>
        <button onClick={() => navigate('/book?package=other')}
          className="mt-4 border border-line-strong text-ink text-sm font-semibold px-5 py-2.5 rounded hover:border-accent transition-colors">
          Request something else
        </button>
      </div>
    </div>
  );
}
