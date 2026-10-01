import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../utils/api.js';

export default function AdminAuthGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | authed | anon
  const location = useLocation();

  useEffect(() => {
    api.get('/admin/auth/session')
      .then(() => setStatus('authed'))
      .catch(() => setStatus('anon'));
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (status === 'anon') {
    return <Navigate to="/admin/login" state={{ next: location.pathname }} replace />;
  }

  return children;
}
