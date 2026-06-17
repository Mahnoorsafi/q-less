import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import { AdminProvider, useAdmin, isSuperAdmin } from './context/AdminContext';
import LoginPage          from './pages/LoginPage';
import DashboardPage      from './pages/DashboardPage';
import QueuePage          from './pages/QueuePage';
import ServicesPage       from './pages/ServicesPage';
import AnalyticsPage      from './pages/AnalyticsPage';
import NotificationsPage  from './pages/NotificationsPage';
import MenuManagementPage from './pages/MenuManagementPage';
import BranchRolePage     from './pages/BranchRolePage';
import AboutPage          from './pages/AboutPage';
import Sidebar            from './components/Sidebar';
import './App.css';

function AppContent() {
  const adminProfile = useAdmin();

  // undefined = still loading auth state
  if (adminProfile === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18, color: '#64748b' }}>
        Loading…
      </div>
    );
  }

  const isLoggedIn = !!adminProfile;
  const superAdmin = isSuperAdmin(adminProfile);

  return (
    <Router>
      <div className="admin-app">
        {isLoggedIn && (
          <Sidebar onLogout={() => signOut(auth)} adminProfile={adminProfile} />
        )}
        <main className="admin-main">
          <Routes>
            <Route path="/login"        element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
            <Route path="/dashboard"    element={isLoggedIn ? <DashboardPage />     : <Navigate to="/login" replace />} />
            <Route path="/queue"        element={isLoggedIn ? <QueuePage />         : <Navigate to="/login" replace />} />
            <Route path="/menu"         element={isLoggedIn ? <MenuManagementPage /> : <Navigate to="/login" replace />} />
            <Route path="/services"     element={isLoggedIn ? <ServicesPage />      : <Navigate to="/login" replace />} />
            <Route path="/analytics"    element={isLoggedIn ? <AnalyticsPage />     : <Navigate to="/login" replace />} />
            <Route path="/notifications" element={isLoggedIn ? <NotificationsPage /> : <Navigate to="/login" replace />} />
            <Route path="/about"        element={isLoggedIn ? <AboutPage />         : <Navigate to="/login" replace />} />
            {/* Branch & Roles page — super admin only */}
            <Route path="/branches"
              element={isLoggedIn
                ? (superAdmin ? <BranchRolePage /> : <Navigate to="/dashboard" replace />)
                : <Navigate to="/login" replace />}
            />
            <Route path="/" element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}
