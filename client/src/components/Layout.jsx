import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, Camera, DollarSign, Users, Settings, Bell, Sun, Moon, X, Inbox, LogOut, Image, MoreHorizontal, BarChart3, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import api from '../utils/api.js';
import logoMarkCharcoal from '../assets/logo/mark-charcoal.png';
import logoMarkWhite from '../assets/logo/mark-white.png';

const NAV = [
  { to: '/admin', label: 'Home', Icon: Home, end: true, mobilePrimary: true },
  { to: '/admin/calendar', label: 'Calendar', Icon: Calendar, mobilePrimary: true },
  { to: '/admin/bookings', label: 'Bookings', Icon: Camera, mobilePrimary: true },
  { to: '/admin/requests', label: 'Requests', Icon: Inbox, badgeKey: 'pendingRequestsCount', mobilePrimary: true },
  { to: '/admin/money-owed', label: 'Money Owed', Icon: DollarSign, mobilePrimary: true },
  { to: '/admin/clients', label: 'Clients', Icon: Users },
  { to: '/admin/portfolio', label: 'Portfolio', Icon: Image },
  { to: '/admin/reports', label: 'Reports', Icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', Icon: Settings },
  { to: '/admin/trash', label: 'Trash', Icon: Trash2 }
];

const MOBILE_PRIMARY = NAV.filter(n => n.mobilePrimary);
const MOBILE_MORE = NAV.filter(n => !n.mobilePrimary);

export default function Layout() {
  const { reminders, dismissReminder, dismissAll, darkMode, setDarkMode, pendingRequestsCount } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const counts = { pendingRequestsCount };
  const moreHasBadge = MOBILE_MORE.some(({ badgeKey }) => badgeKey && counts[badgeKey] > 0);

  const logout = async () => {
    await api.post('/admin/auth/logout').catch(() => {});
    navigate('/admin/login');
  };

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <img src={darkMode ? logoMarkWhite : logoMarkCharcoal} alt="" className="h-7 w-auto" />
          <h1 className="text-base font-bold text-gray-900 dark:text-white">Ruben Bhujel</h1>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ to, label, Icon, end, badgeKey }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60'
                }`
              }>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {badgeKey && counts[badgeKey] > 0 && (
                <span className="ml-auto bg-sky-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold leading-none">
                  {counts[badgeKey] > 9 ? '9+' : counts[badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              {reminders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {reminders.length > 9 ? '9+' : reminders.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotifPanel
                reminders={reminders}
                onDismiss={dismissReminder}
                onDismissAll={dismissAll}
                onClose={() => setNotifOpen(false)}
                navigate={navigate}
              />
            )}
          </div>
          <button onClick={logout} title="Log out"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={darkMode ? logoMarkWhite : logoMarkCharcoal} alt="" className="h-6 w-auto" />
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Ruben Bhujel</h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              {darkMode ? <Sun className="w-4 h-4 text-gray-500" /> : <Moon className="w-4 h-4 text-gray-500" />}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                {reminders.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {reminders.length > 9 ? '9+' : reminders.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotifPanel
                  reminders={reminders}
                  onDismiss={dismissReminder}
                  onDismissAll={dismissAll}
                  onClose={() => setNotifOpen(false)}
                  navigate={navigate}
                  mobile
                />
              )}
            </div>
            <button onClick={logout} title="Log out" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <LogOut className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6 overflow-auto dark:bg-gray-900">
          <Outlet />
        </div>

        {/* Bottom nav (mobile) */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setMoreOpen(false)}>
            <div onClick={e => e.stopPropagation()}
              className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl border-t border-gray-200 dark:border-gray-700 p-3 grid grid-cols-4 gap-2">
              {MOBILE_MORE.map(({ to, label, Icon, end, badgeKey }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center py-3 gap-1 rounded-xl text-xs font-medium transition-colors ${
                      isActive ? 'text-sky-600 bg-sky-50 dark:bg-sky-900/30' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`
                  }>
                  <span className="relative">
                    <Icon className="w-5 h-5" />
                    {badgeKey && counts[badgeKey] > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-sky-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                        {counts[badgeKey] > 9 ? '9+' : counts[badgeKey]}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px]">{label.split(' ')[0]}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
        <nav className="md:hidden sticky bottom-0 z-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 grid grid-cols-6">
          {MOBILE_PRIMARY.map(({ to, label, Icon, end, badgeKey }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-sky-600' : 'text-gray-400'
                }`
              }>
              <span className="relative">
                <Icon className="w-5 h-5" />
                {badgeKey && counts[badgeKey] > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-sky-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                    {counts[badgeKey] > 9 ? '9+' : counts[badgeKey]}
                  </span>
                )}
              </span>
              <span className="text-[10px]">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(o => !o)}
            className={`relative flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
              moreOpen ? 'text-sky-600' : 'text-gray-400'
            }`}>
            <span className="relative">
              <MoreHorizontal className="w-5 h-5" />
              {moreHasBadge && (
                <span className="absolute -top-1 -right-1.5 bg-sky-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none" />
              )}
            </span>
            <span className="text-[10px]">More</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

function NotifPanel({ reminders, onDismiss, onDismissAll, onClose, navigate, mobile }) {
  return (
    <div className={`absolute ${mobile ? 'right-0 top-full mt-1' : 'left-full ml-2 bottom-0'} w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50`}>
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm dark:text-white">Alerts ({reminders.length})</span>
        <div className="flex gap-3 items-center">
          {reminders.length > 0 && (
            <button onClick={onDismissAll} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {reminders.length === 0 ? (
          <p className="text-sm text-gray-400 p-4 text-center">No active alerts</p>
        ) : reminders.map(r => (
          <div key={r.id} className="flex items-start gap-2 p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm flex-1 dark:text-gray-300 leading-snug">{r.message}</span>
            <button onClick={() => onDismiss(r.id)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
