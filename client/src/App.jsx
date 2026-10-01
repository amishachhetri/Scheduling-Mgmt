import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';
import AdminAuthGate from './components/AdminAuthGate.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import NewBooking from './pages/NewBooking.jsx';
import Requests from './pages/Requests.jsx';
import MoneyOwed from './pages/MoneyOwed.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import PublicHome from './pages/public/Home.jsx';
import PublicPackages from './pages/public/Packages.jsx';
import PublicBookingFlow from './pages/public/BookingFlow.jsx';
import PublicPortfolio from './pages/public/Portfolio.jsx';
import PublicReels from './pages/public/Reels.jsx';
import PublicAbout from './pages/public/About.jsx';
import PublicStatusCheck from './pages/public/StatusCheck.jsx';
import PublicGallery from './pages/public/PublicGallery.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        {/* Public, client-facing site */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<PublicHome />} />
          <Route path="portfolio" element={<PublicPortfolio />} />
          <Route path="reels" element={<PublicReels />} />
          <Route path="packages" element={<PublicPackages />} />
          <Route path="about" element={<PublicAbout />} />
          <Route path="book" element={<PublicBookingFlow />} />
          <Route path="status" element={<PublicStatusCheck />} />
        </Route>

        {/* Client proofing gallery — standalone, no site nav/footer (reached via a private link) */}
        <Route path="/gallery/:token" element={<PublicGallery />} />

        {/* Admin login (outside the authenticated tree / AppProvider) */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Authenticated admin tool */}
        <Route path="/admin/*" element={
          <AppProvider>
            <AdminAuthGate>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="bookings/new" element={<NewBooking />} />
                  <Route path="bookings/:id" element={<BookingDetail />} />
                  <Route path="requests" element={<Requests />} />
                  <Route path="money-owed" element={<MoneyOwed />} />
                  <Route path="clients" element={<Clients />} />
                  <Route path="clients/:id" element={<ClientDetail />} />
                  <Route path="portfolio" element={<Portfolio />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>
              </Routes>
            </AdminAuthGate>
          </AppProvider>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
