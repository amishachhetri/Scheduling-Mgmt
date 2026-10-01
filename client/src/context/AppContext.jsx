import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [reminders, setReminders] = useState([]);
  const [requests, setRequests] = useState([]);
  const pendingRequestsCount = requests.length;
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  // Bump this to signal all dashboard/list pages to refetch
  const [dataVersion, setDataVersion] = useState(0);

  const refresh = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await api.get('/reminders');
      setReminders(res.data);
    } catch {}
  }, []);

  // Shared across Layout (nav badge count) and Dashboard (top-3 request cards) so both read
  // from one fetch instead of each polling /admin/requests separately.
  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/admin/requests');
      setRequests(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchReminders();
    fetchRequests();
    const id = setInterval(() => { fetchReminders(); fetchRequests(); }, 60000);
    return () => clearInterval(id);
  }, [fetchReminders, fetchRequests]);

  // Refetch reminders/requests whenever underlying data changes
  useEffect(() => {
    if (dataVersion > 0) { fetchReminders(); fetchRequests(); }
  }, [dataVersion, fetchReminders, fetchRequests]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const dismissReminder = async (id) => {
    await api.put(`/reminders/${id}/dismiss`);
    setReminders(r => r.filter(x => x.id !== id));
  };

  const dismissAll = async () => {
    await api.put('/reminders/dismiss-all');
    setReminders([]);
  };

  return (
    <AppContext.Provider value={{
      reminders, fetchReminders, dismissReminder, dismissAll,
      requests, pendingRequestsCount, fetchRequests,
      darkMode, setDarkMode,
      dataVersion, refresh
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
