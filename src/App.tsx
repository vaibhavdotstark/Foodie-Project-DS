import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MasterLayout } from './components/layout/MasterLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { UserRegistrationPage } from './pages/UserRegistrationPage';
import { MachinesPage } from './pages/MachinesPage';
import { ClientsPage } from './pages/ClientsPage';
import { PlaceholderView } from './components/common/PlaceholderView';
import { SessionTimeoutTracker } from './components/auth/SessionTimeoutTracker';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    const isExpired = sessionStorage.getItem('foodie_session_expired') === 'true';
    const expiredEmail = sessionStorage.getItem('foodie_expired_email');
    if (isExpired) {
      return (
        <Navigate
          to={`/login?view=expired${expiredEmail ? `&email=${encodeURIComponent(expiredEmail)}` : ''}`}
          replace
        />
      );
    }
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role === 'OPERATOR') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const AppContent: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated Application with Master Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MasterLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverviewPage />} />
        <Route path="sites" element={<Navigate to="/" replace />} />
        <Route
          path="users"
          element={
            <ProtectedRoute adminOnly>
              <UserRegistrationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machines"
          element={
            <ProtectedRoute adminOnly>
              <MachinesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients"
          element={
            <ProtectedRoute adminOnly>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sustainability"
          element={
            <ProtectedRoute>
              <PlaceholderView
                title="Sustainability & Environmental Impact"
                subtitle="Track CO2 diversion, organic landfill mitigation, and green carbon credits across all client composter installations."
                tag="P2 Roadmap Milestone"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute>
              <PlaceholderView
                title="Fleet Telemetry & Operational Reports"
                subtitle="Export aggregated power usage, batch volume summaries, and ESG compliance certificates in PDF and CSV format."
                tag="Reporting Engine"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="alerts"
          element={
            <ProtectedRoute>
              <PlaceholderView
                title="System Notifications & Telemetry Alerts"
                subtitle="Live stream of PLC temperature triggers, motor overloads, door sensor faults, and offline machine alerts."
                tag="Telemetry Service"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <PlaceholderView
                title="OEM Workspace & System Configuration"
                subtitle="Manage API keys, Modbus network gateways, email relay providers, and enterprise security policies."
                tag="System Admin"
              />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SessionTimeoutTracker />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
