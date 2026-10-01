import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import api from '../utils/api.js';
import logoLockup from '../assets/logo/lockup-charcoal.png';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/reels', label: 'Reels' },
  { to: '/packages', label: 'Packages' },
  { to: '/about', label: 'About' }
];

export default function PublicLayout() {
  const [businessName, setBusinessName] = useState('Photography Studio');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.get('/public/profile').then(r => {
      if (r.data?.business_name) {
        setBusinessName(r.data.business_name);
        // index.html ships a generic placeholder title -- once the real business name loads,
        // the browser tab/bookmark should reflect it instead.
        document.title = r.data.business_name;
      }
      if (r.data?.instagram_url) setInstagramUrl(r.data.instagram_url);
    }).catch(() => {});
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="public-site min-h-screen bg-paper text-ink font-sans flex flex-col">
      <header className="border-b border-line relative z-20 bg-paper">
        <div className="flex items-center justify-between gap-3 px-6 md:px-10 py-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <img src={logoLockup} alt={businessName} className="h-12 w-auto shrink-0" />
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-sm text-ink-soft shrink-0">
            {NAV_LINKS.map(l => (
              <Link key={l.to} to={l.to} className={isActive(l.to) ? 'text-ink font-semibold' : 'hover:text-ink transition-colors'}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link to="/book" className="bg-accent text-white text-sm font-semibold px-4 py-2.5 rounded whitespace-nowrap">Book Now</Link>
            <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden p-2 -mr-2 text-ink" aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="sm:hidden px-6 pb-4 flex flex-col gap-1 text-sm border-t border-line pt-3">
            {NAV_LINKS.map(l => (
              <Link key={l.to} to={l.to}
                className={`py-2 ${isActive(l.to) ? 'text-ink font-semibold' : 'text-ink-soft'}`}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="px-6 md:px-10 py-6 border-t border-line flex flex-wrap justify-between gap-x-5 gap-y-2 text-xs text-ink-faint">
        <span>© {new Date().getFullYear()} {businessName}</span>
        <div className="flex items-center gap-5">
          {instagramUrl && (
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="hover:text-ink-soft transition-colors" aria-label="Instagram">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          <Link to="/status" className="hover:text-ink-soft transition-colors">Check booking status</Link>
          <Link to="/book" className="hover:text-ink-soft transition-colors">Book a session →</Link>
        </div>
      </footer>
    </div>
  );
}
