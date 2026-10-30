import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  LayoutGrid,
  Zap,
  Bell,
  Leaf,
  Plus,
} from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { FleetEnergyChart } from './FleetEnergyChart';
import { AddClientModal } from '../clients/AddClientModal';
import { AddMachineDrawer } from '../machines/AddMachineDrawer';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, orgsApi, machinesApi } from '../../services/api';
import type { Organization, Machine, DashboardStats } from '../../types';

export const OemDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Modals & Drawers state
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);

  // Live PostgreSQL & Telemetry Data State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [stats, orgList, machineList] = await Promise.all([
        dashboardApi.getStats().catch((err) => {
          console.error('Failed to load live dashboard stats:', err);
          return null;
        }),
        orgsApi.getAll().catch(() => []),
        machinesApi.getAll().catch(() => []),
      ]);

      if (stats) setDashboardStats(stats);
      setOrganizations(orgList);
      setMachines(machineList);
    } catch (err) {
      console.error('Error fetching OEM dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const recentClients = dashboardStats?.recent_clients || [];
  const attentionMachines = dashboardStats?.attention_machines || [];
  const upcomingMaintenance = dashboardStats?.upcoming_maintenance || [];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* Top Welcome Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
            Welcome, {user ? `${user.first_name} ${user.last_name}` : 'PowerTech Admin'}
          </h1>
          <p className="text-xs text-[#888888] mt-0.5">
            Fleet overview across all clients · Live database &amp; telemetry
          </p>
        </div>

        {/* Action Buttons: + Add client & + Add machine */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddClientOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[#D1D5DB] bg-white text-[#171717] hover:bg-[#F9FAFB] transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#171717]" />
            <span>Add client</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddMachineOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Add machine</span>
          </button>
        </div>
      </div>

      {/* 5 Top Metric Cards Row (Live computed PostgreSQL aggregates) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MetricCard
          id="metric-clients"
          title="Clients"
          value={dashboardStats ? dashboardStats.total_clients : organizations.length}
          subtitle={
            dashboardStats
              ? `${dashboardStats.clients_onboarded_this_month} onboarded this month`
              : 'All active accounts'
          }
          icon={Users}
          onClick={() => navigate('/clients')}
        />

        <MetricCard
          id="metric-machines"
          title="Machines"
          value={dashboardStats ? dashboardStats.total_machines : machines.length}
          subtitle={
            dashboardStats
              ? `${dashboardStats.online_machines} online · ${dashboardStats.offline_machines} offline`
              : 'Fleet status'
          }
          icon={LayoutGrid}
          onClick={() => navigate('/machines')}
        />

        <MetricCard
          id="metric-energy"
          title="Energy consumed"
          value={dashboardStats ? dashboardStats.energy_consumed_today_kwh.toLocaleString() : '0'}
          unit="kWh"
          subtitle="Today, all machines"
          icon={Zap}
        />

        <MetricCard
          id="metric-alerts"
          title="Open alerts"
          value={dashboardStats ? dashboardStats.open_alerts_count : 0}
          valueColor={
            dashboardStats && dashboardStats.open_alerts_count > 0
              ? 'text-[#E32032]'
              : 'text-[#171717]'
          }
          subtitle={
            dashboardStats && dashboardStats.open_alerts_count > 0
              ? `Across ${dashboardStats.alert_clients_count} client${dashboardStats.alert_clients_count === 1 ? '' : 's'}`
              : 'All systems normal'
          }
          icon={Bell}
          iconVariant={
            dashboardStats && dashboardStats.open_alerts_count > 0 ? 'danger' : 'default'
          }
        />

        <MetricCard
          id="metric-waste"
          title="Waste intake"
          value={dashboardStats ? dashboardStats.waste_intake_today_kg.toLocaleString() : '0'}
          unit="kg"
          subtitle="Load cell · today, all machines"
          icon={Leaf}
          iconVariant="success"
        />
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (67% Width): Energy usage + Recently onboarded clients */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Live 14-Day Fleet Energy Usage Smooth Area Curve Chart */}
          <FleetEnergyChart data={dashboardStats?.energy_history_14d || []} />

          {/* 2. Recently Onboarded Clients Table (Live from PostgreSQL) */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-sm font-bold text-[#171717]">
                Recently onboarded clients
              </h2>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="text-xs font-bold text-[#E32032] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All clients</span>
                <span className="text-sm">→</span>
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              {recentClients.length === 0 ? (
                <div className="py-8 text-center text-[#888888] text-xs">
                  {isLoading
                    ? 'Loading live clients...'
                    : 'No clients onboarded yet. Click "Add client" above to onboard your first client.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280]">
                      <th className="py-2.5 px-3 font-semibold">Client ID</th>
                      <th className="py-2.5 px-3 font-semibold">Company name</th>
                      <th className="py-2.5 px-3 font-semibold">Onboarding date</th>
                      <th className="py-2.5 px-3 font-semibold">Machines</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {recentClients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => navigate(`/clients?select=${client.id}`)}
                        className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-[#E32032] underline hover:text-[#C1121F]">
                            {client.client_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#171717]">
                          {client.company_name}
                        </td>
                        <td className="py-2.5 px-3 text-[#6B7280]">
                          {client.onboard_date}
                        </td>
                        <td className="py-2.5 px-3 text-[#171717] font-medium">
                          {client.machines_count}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00C951]" />
                            <span>{client.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (33% Width): Machines needing attention + Upcoming maintenance */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 1. Machines Needing Attention (Live alerts & connectivity) */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-sm font-bold text-[#171717]">
                Machines needing attention
              </h2>
              <button
                type="button"
                onClick={() => navigate('/machines')}
                className="text-xs font-bold text-[#E32032] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All machines</span>
                <span className="text-sm">→</span>
              </button>
            </div>

            {attentionMachines.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#16A34A] bg-emerald-50/50 rounded-lg border border-emerald-100 my-2">
                ✓ All machines operating normally. No active alerts.
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6] mt-1">
                {attentionMachines.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate('/machines')}
                        className="font-bold text-[#E32032] underline hover:text-[#C1121F] block text-left"
                      >
                        {m.machine_code}
                      </button>
                      <div className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                        {m.client} · {m.issue}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
                        m.variant === 'offline'
                          ? 'bg-slate-100 text-[#4B5563] border-slate-200'
                          : m.variant === 'high' || m.variant === 'danger'
                          ? 'bg-red-50 text-[#E32032] border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.variant === 'offline'
                            ? 'bg-[#9CA3AF]'
                            : m.variant === 'high' || m.variant === 'danger'
                            ? 'bg-[#E32032]'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{m.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Upcoming Maintenance (Live from maintenance_schedules table) */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-sm font-bold text-[#171717]">
                Upcoming maintenance
              </h2>
            </div>

            {upcomingMaintenance.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#888888] bg-gray-50/50 rounded-lg border border-gray-100 my-2">
                No maintenance scheduled for the next 30 days.
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6] mt-1">
                {upcomingMaintenance.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate('/machines')}
                        className="font-bold text-[#E32032] underline hover:text-[#C1121F] block text-left"
                      >
                        {item.machine_code}
                      </button>
                      <div className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                        {item.client} · {item.task}
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-[#171717] flex-shrink-0">
                      {item.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reusable Modals & Drawers */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />

      <AddMachineDrawer
        isOpen={isAddMachineOpen}
        onClose={() => setIsAddMachineOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
};

