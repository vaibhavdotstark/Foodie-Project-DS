import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OemDashboardView } from '../components/dashboard/OemDashboardView';
import { machinesApi, dashboardApi } from '../services/api';
import type { Machine, DashboardStats } from '../types';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // If authenticated user is OEM Manager or no role specified, render OEM Fleet View
  if (!user || user.role === 'OEM_MANAGER' || user.role === 'SITE_ADMIN') {
    return <OemDashboardView />;
  }

  const isOperator = user?.role === 'OPERATOR';
  const [machines, setMachines] = useState<Machine[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [machineList, dashStats] = await Promise.all([
          machinesApi.getAll().catch(() => []),
          dashboardApi.getStats().catch(() => null),
        ]);
        setMachines(machineList);
        setStats(dashStats);
      } catch (err) {
        console.error('Failed to load operator dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const totalRunning = machines.filter(
    (m) => m.connectivity_status?.toLowerCase() === 'online'
  ).length;
  const totalOffline = machines.filter(
    (m) => m.connectivity_status?.toLowerCase() === 'offline'
  ).length;


  const kpis = [
    {
      label: 'TOTAL MACHINES',
      value: String(stats?.total_machines ?? machines.length),
      subtext: `${totalRunning} Online • ${totalOffline} Offline`,
      color: 'text-[#171717]',
    },
    {
      label: 'WASTE INTAKE (TODAY)',
      value: `${stats?.waste_intake_today_kg ?? 0} kg`,
      subtext: 'Load cell daily total',
      color: 'text-[#00C951]',
    },
    {
      label: 'COMPOST PRODUCED',
      value: `${stats?.compost_produced_today_kg ?? 0} kg`,
      subtext: '50% Volume Reduction',
      color: 'text-[#0A7135]',
    },
    {
      label: 'ENERGY CONSUMED',
      value: `${stats?.energy_consumed_today_kwh ?? 0} kWh`,
      subtext: 'Across all active units',
      color: 'text-[#E32032]',
    },
    {
      label: 'ACTIVE ALERTS',
      value: String(stats?.open_alerts_count ?? 0),
      subtext: 'Requires review',
      color: 'text-[#E32032]',
    },
    {
      label: 'ONLINE MACHINES',
      value: `${stats?.online_machines ?? totalRunning}`,
      subtext: `${stats?.offline_machines ?? totalOffline} offline`,
      color: 'text-[#0A7135]',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E3E4E6]">
        <div>
          <h1 className="text-xl font-extrabold text-[#171717]">Fleet Overview & Operations</h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Commercial composter telemetry and multi-site biological operations.
          </p>
        </div>

        {!isOperator && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/sites')}
              className="bg-white hover:bg-slate-50 text-[#171717] border border-[#E3E4E6] px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-[#E32032]" />
              <span>Register Site</span>
            </button>
            <button
              onClick={() => navigate('/users')}
              className="bg-[#E32032] hover:bg-[#C71828] text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Register User</span>
            </button>
          </div>
        )}
      </div>

      {/* 6 Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E3E4E6] rounded-xl p-4 flex flex-col justify-between shadow-xs hover:border-[#171717] transition-all"
          >
            <span className="text-[10px] font-bold text-[#666666] tracking-wider uppercase mb-2">
              {kpi.label}
            </span>
            <div className={`text-2xl font-extrabold tracking-tight ${kpi.color}`}>
              {kpi.value}
            </div>
            <span className="text-[10px] text-[#666666] mt-2 font-medium">
              {kpi.subtext}
            </span>
          </div>
        ))}
      </div>

      {/* Fleet Live Table */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171717]">Connected Foodie Composters ({machines.length} Units)</h2>
            {!isOperator && (
              <p className="text-[11px] text-[#666666]">Live PLC and Victron ET340 telemetry streams</p>
            )}
          </div>
          <span className="text-xs font-bold text-[#0A7135] bg-[#D7FFE6] px-2.5 py-1 rounded">
            All Sites Active
          </span>
        </div>

        <div className="overflow-x-auto">
          {machines.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#888888]">
              {isLoading ? 'Loading live machines...' : 'No machines found in fleet.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E3E4E6] text-[11px] font-bold text-[#666666] uppercase tracking-wider">
                  <th className="py-3 px-5">Machine ID</th>
                  <th className="py-3 px-5">Model</th>
                  <th className="py-3 px-5">Capacity</th>
                  <th className="py-3 px-5">Location</th>
                  <th className="py-3 px-5">Client</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E4E6] text-xs text-[#171717]">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5 font-bold font-mono text-[#E32032]">{m.machine_code || m.id}</td>
                    <td className="py-3.5 px-5 font-semibold text-[#171717]">{m.model}</td>
                    <td className="py-3.5 px-5 text-[#666666]">{m.capacity || '50 kg/day'}</td>
                    <td className="py-3.5 px-5 text-[#171717]">
                      <div className="font-semibold">{m.location_label || 'Central Facility'}</div>
                      <div className="text-[11px] text-[#666666]">{m.serial_number ? `SN: ${m.serial_number}` : ''}</div>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[#171717]">
                      {m.company_name ? `${m.company_name} (${m.client_code || 'Assigned'})` : 'Available'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        m.connectivity_status?.toLowerCase() === 'online'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          m.connectivity_status?.toLowerCase() === 'online' ? 'bg-[#00C951]' : 'bg-[#9CA3AF]'
                        }`} />
                        <span>{m.connectivity_status || 'ONLINE'}</span>
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
  );
};
