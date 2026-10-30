import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  Bell,
  Leaf,
  ArrowRight,
  Cpu,
  CheckCircle2,
  Building2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { FleetEnergyChart } from './FleetEnergyChart';
import { MachineDetailDrawer } from '../machines/MachineDetailDrawer';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, machinesApi } from '../../services/api';
import type { Machine, DashboardStats } from '../../types';

export const ClientDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [stats, machineList] = await Promise.all([
        dashboardApi.getStats().catch((err) => {
          console.error('Failed to load client stats:', err);
          return null;
        }),
        machinesApi.getAll().catch((err) => {
          console.error('Failed to load client machines:', err);
          return [];
        }),
      ]);

      if (stats) setDashboardStats(stats);
      setMachines(machineList);
    } catch (err) {
      console.error('Error fetching client dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalMachines = machines.length;
  const onlineMachines = machines.filter(
    (m) => m.connectivity_status?.toLowerCase() === 'online'
  ).length;
  const offlineMachines = totalMachines - onlineMachines;

  const attentionMachines = dashboardStats?.attention_machines || [];
  const openAlerts = dashboardStats?.open_alerts_count || 0;

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-10">
      {/* Top Welcome Header & Client Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-b border-[#E3E4E6] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
              Welcome, {user?.first_name ? `${user.first_name}` : (user?.company_name || 'Client')}
            </h1>
            {user?.client_code && (
              <span className="font-mono text-xs font-bold text-[#E32032] bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                {user.client_code}
              </span>
            )}
          </div>
          <p className="text-xs text-[#666666] mt-0.5">
            {user?.company_name || 'Facility Operations'} · Real-time commercial composter telemetry & energy monitoring
          </p>
        </div>

        {/* Status Indicator Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E3E4E6] px-3 py-1.5 rounded-full text-xs font-semibold text-[#171717] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#00C951] animate-pulse" />
            <span>Facility Status: Normal</span>
          </div>
        </div>
      </div>

      {/* 5 Top Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <MetricCard
          id="client-metric-machines"
          title="Assigned machines"
          value={totalMachines}
          subtitle={`${onlineMachines} online · ${offlineMachines} offline`}
          icon={LayoutGrid}
          onClick={() => navigate('/machines')}
        />

        <MetricCard
          id="client-metric-waste"
          title="Waste intake"
          value={dashboardStats ? dashboardStats.waste_intake_today_kg.toLocaleString() : '0'}
          unit="kg"
          subtitle="Load cell · today"
          icon={Leaf}
          iconVariant="success"
        />

        <MetricCard
          id="client-metric-compost"
          title="Compost produced"
          value={dashboardStats ? dashboardStats.compost_produced_today_kg.toLocaleString() : '0'}
          unit="kg"
          subtitle="50% volume reduction"
          icon={Leaf}
        />

        <MetricCard
          id="client-metric-energy"
          title="Energy consumed"
          value={dashboardStats ? dashboardStats.energy_consumed_today_kwh.toLocaleString() : '0'}
          unit="kWh"
          subtitle="Today across assigned units"
          icon={Zap}
        />

        <MetricCard
          id="client-metric-alerts"
          title="Open alerts"
          value={openAlerts}
          valueColor={openAlerts > 0 ? 'text-[#E32032]' : 'text-[#171717]'}
          subtitle={openAlerts > 0 ? 'Requires attention' : 'All systems normal'}
          icon={Bell}
          iconVariant={openAlerts > 0 ? 'danger' : 'default'}
          onClick={() => navigate('/alerts')}
        />
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Energy Chart & Assigned Machines */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* 1. Live Energy Usage Chart */}
          <FleetEnergyChart data={dashboardStats?.energy_history_14d || []} />

          {/* 2. Assigned Composter Units Main Table */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#E32032]" />
                <h2 className="text-sm font-bold text-[#171717]">
                  Assigned composter units ({totalMachines})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/machines')}
                className="text-xs font-bold text-[#E32032] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all machines</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              {isLoading ? (
                <div className="py-8 text-center text-[#888888] text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#E32032]" />
                  <span>Loading assigned equipment...</span>
                </div>
              ) : machines.length === 0 ? (
                <div className="py-10 text-center text-xs">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-[#888888]">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-[#171717]">No composter units assigned yet</p>
                  <p className="text-[#888888] mt-1 max-w-sm mx-auto">
                    PowerTech Energy is provisioning equipment for your facility. Telemetry streams will appear here once connected.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280]">
                      <th className="py-2.5 px-3 font-semibold">Machine code</th>
                      <th className="py-2.5 px-3 font-semibold">Model</th>
                      <th className="py-2.5 px-3 font-semibold">Capacity</th>
                      <th className="py-2.5 px-3 font-semibold">Location</th>
                      <th className="py-2.5 px-3 font-semibold">Connectivity</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Telemetry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {machines.map((m) => {
                      const isOnline = m.connectivity_status?.toLowerCase() === 'online';
                      const opStatus = m.operational_status || 'Idle';

                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-[#F9FAFB] transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold">
                            <button
                              type="button"
                              onClick={() => setSelectedMachine(m)}
                              className="text-[#E32032] underline hover:text-[#C1121F] cursor-pointer"
                            >
                              {m.machine_code || m.serial_number}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#171717]">
                            {m.model}
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">
                            {m.capacity || '50 kg/day'}
                          </td>
                          <td className="py-2.5 px-3 text-[#171717]">
                            <div className="font-medium">{m.location_label || m.site_name || 'Main Facility'}</div>
                            {m.serial_number && (
                              <div className="text-[10px] text-[#888888]">SN: {m.serial_number}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-[#00C951]' : 'bg-[#9CA3AF]'
                                }`}
                              />
                              <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                opStatus === 'Running'
                                  ? 'bg-[#EAFBF1] text-[#0A7135] border-[#B7F4CE]'
                                  : opStatus === 'Idle'
                                  ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                  : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  opStatus === 'Running'
                                    ? 'bg-[#00C951]'
                                    : opStatus === 'Idle'
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span>{opStatus}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedMachine(m)}
                              className="text-xs font-semibold text-[#171717] hover:text-[#E32032] underline cursor-pointer"
                            >
                              View specs
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Attention Items & Facility Profile Card */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* 1. Equipment Attention & Health */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-sm font-bold text-[#171717]">
                Equipment health &amp; attention
              </h2>
              <button
                type="button"
                onClick={() => navigate('/alerts')}
                className="text-xs font-bold text-[#E32032] hover:underline cursor-pointer"
              >
                Alerts
              </button>
            </div>

            {attentionMachines.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-[#16A34A] bg-emerald-50/60 rounded-xl border border-emerald-100 my-2">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-[#16A34A]" />
                <span className="font-semibold block">All composter units nominal</span>
                <span className="text-[11px] text-[#6B7280] mt-0.5 block">
                  Thermal digestion, agitator motors, and Victron power meters operating without faults.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6] mt-1">
                {attentionMachines.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-[#E32032] block">
                        {m.machine_code}
                      </span>
                      <div className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                        {m.issue}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-[#E32032] border border-red-200">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Facility Account & Service Details */}
          <div className="bg-white rounded-xl border border-[#E3E4E6] p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F3F4F6]">
              <Building2 className="w-4 h-4 text-[#171717]" />
              <h2 className="text-sm font-bold text-[#171717]">
                Facility profile
              </h2>
            </div>

            <div className="mt-3.5 space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-[#888888] font-medium block">Organization Name</span>
                <span className="font-bold text-[#171717]">{user?.company_name || 'Green Valley Foods'}</span>
              </div>

              {user?.client_code && (
                <div>
                  <span className="text-[11px] text-[#888888] font-medium block">Account Client Code</span>
                  <span className="font-mono font-bold text-[#E32032]">{user.client_code}</span>
                </div>
              )}

              <div>
                <span className="text-[11px] text-[#888888] font-medium block">Registered Account Email</span>
                <span className="text-[#171717]">{user?.email || 'client@example.com'}</span>
              </div>

              <div className="pt-2 border-t border-[#F3F4F6]">
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-[11px] font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Lease &amp; SLA Active · PowerTech Energy 24/7 Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Detail Drawer */}
      <MachineDetailDrawer
        isOpen={Boolean(selectedMachine)}
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </div>
  );
};
