import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import api from '../utils/api.js';
import logoMark from '../assets/logo/mark-charcoal.png';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessName, setBusinessName] = useState('Photography Studio');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.get('/public/profile').then(r => {
      if (r.data?.business_name) setBusinessName(r.data.business_name);
    }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/auth/login', { password });
      navigate(location.state?.next || '/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-site min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-paper-raised rounded-2xl shadow-sm border border-line p-7">
        <div className="flex items-center gap-2.5 mb-7">
          <img src={logoMark} alt="" className="h-8 w-auto shrink-0" />
          <div className="min-w-0">
            <div className="font-display text-lg text-ink truncate leading-tight">{businessName}</div>
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Studio Admin</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-ink-soft mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                id="admin-password"
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-3 py-2.5 border border-line rounded-xl text-sm bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          {error && <p className="text-sm text-declined">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-accent hover:opacity-90 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-opacity">
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
