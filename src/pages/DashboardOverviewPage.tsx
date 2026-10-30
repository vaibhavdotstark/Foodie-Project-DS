import React from 'react';
import { useAuth } from '../context/AuthContext';
import { OemDashboardView } from '../components/dashboard/OemDashboardView';
import { ClientDashboardView } from '../components/dashboard/ClientDashboardView';

export const DashboardOverviewPage: React.FC = () => {
  const { user } = useAuth();

  // Render OEM Manager fleet dashboard for OEM Managers
  if (user?.role === 'OEM_MANAGER') {
    return <OemDashboardView />;
  }

  // Render dedicated Client Dashboard for client user accounts (SITE_ADMIN, OPERATOR)
  return <ClientDashboardView />;
};
