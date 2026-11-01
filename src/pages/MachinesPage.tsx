import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Eye,
  Edit2,
  Trash2,
  Cpu,
  RefreshCw,
  X,
} from 'lucide-react';
import { machinesApi, orgsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AddMachineDrawer } from '../components/machines/AddMachineDrawer';
import { MachineDetailDrawer } from '../components/machines/MachineDetailDrawer';
import { EditMachineDrawer } from '../components/machines/EditMachineDrawer';
import { DeleteMachineModal } from '../components/machines/DeleteMachineModal';
import { Toast } from '../components/common/Toast';
import type { Machine, Organization } from '../types';

export const MachinesPage: React.FC = () => {
  const { user } = useAuth();
  const isOem = user?.role === 'OEM_MANAGER';
  const [searchParams] = useSearchParams();

  // Live PostgreSQL Data States
  const [machines, setMachines] = useState<Machine[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All clients');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [modelFilter, setModelFilter] = useState<string>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Row Actions Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Drawers & Modals State
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load live data from PostgreSQL API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [machineList, orgList] = await Promise.all([
        machinesApi.getAll().catch(() => []),
        orgsApi.getAll().catch(() => []),
      ]);
      setMachines(machineList);
      setOrganizations(orgList);
    } catch (err) {
      console.error('Failed to load fleet machines data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('serial') || searchParams.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    const targetSerial = searchParams.get('serial') || searchParams.get('search');
    if (targetSerial && machines.length > 0) {
      const found = machines.find(
        (m) =>
          (m.serial_number && m.serial_number.toLowerCase() === targetSerial.toLowerCase()) ||
          (m.machine_code && m.machine_code.toLowerCase() === targetSerial.toLowerCase())
      );
      if (found) {
        setSelectedMachine(found);
      }
    }
  }, [searchParams, machines]);

  // Click outside listener for the row action menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute dynamic top metric card counts from real database data
  const totalCount = machines.length;
  const runningCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'running'
  ).length;
  const idleCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'idle'
  ).length;
  const maintenanceCount = machines.filter(
    (m) => (m.operational_status || '').toLowerCase() === 'maintenance'
  ).length;

  // Date Formatter: "19 May 2026"
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Location Formatter
  const formatLocation = (machine: Machine): string => {
    if (machine.location_label && machine.location_label.trim()) {
      return machine.location_label;
    }
    if (machine.site_name) {
      const parts = machine.site_name.split('—').map((s) => s.trim());
      return parts[parts.length - 1] || machine.site_name;
    }
    return '—';
  };

  // Unique locations / sites from fleet
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    machines.forEach((m) => {
      if (m.site_name) locSet.add(m.site_name);
      else if (m.location_label) locSet.add(m.location_label);
    });
    return Array.from(locSet).filter(Boolean);
  }, [machines]);

  // Filter Pipeline
  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const code = (machine.machine_code || '').toLowerCase();
      const serial = (machine.serial_number || '').toLowerCase();
      const model = (machine.model || '').toLowerCase();
      const client = (machine.company_name || '').toLowerCase();
      const location = (machine.location_label || '').toLowerCase();
      const site = (machine.site_name || '').toLowerCase();

      const matchesSearch =
        !q ||
        code.includes(q) ||
        serial.includes(q) ||
        model.includes(q) ||
        client.includes(q) ||
        location.includes(q) ||
        site.includes(q);

      // 2. Status Filter
      const opStatus = (machine.operational_status || 'Idle').toLowerCase();
      const connStatus = (machine.connectivity_status || 'Offline').toLowerCase();
      const matchesStatus =
        statusFilter === 'All' ||
        opStatus === statusFilter.toLowerCase() ||
        (statusFilter.toLowerCase() === 'offline' && connStatus === 'offline');

      // 3. Client Filter
      const matchesClient =
        clientFilter === 'All clients' ||
        (machine.company_name &&
          machine.company_name.toLowerCase() === clientFilter.toLowerCase()) ||
        machine.organization_id === clientFilter;

      // 4. Site / Location Filter (Site wise)
      const matchesLocation =
        locationFilter === 'All locations' ||
        (machine.site_name && machine.site_name.toLowerCase().includes(locationFilter.toLowerCase())) ||
        (machine.location_label && machine.location_label.toLowerCase().includes(locationFilter.toLowerCase()));

      // 5. Model Filter
      const matchesModel =
        modelFilter === 'All' ||
        machine.model.toLowerCase() === modelFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesClient &&
        matchesLocation &&
        matchesModel
      );
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || '').getTime() || 0;
      const dateB = new Date(b.created_at || '').getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.machine_code || '').localeCompare(a.machine_code || '', undefined, { numeric: true });
    });
  }, [
    machines,
    searchQuery,
    statusFilter,
    clientFilter,
    locationFilter,
    modelFilter,
  ]);

  // Pagination Slice
  const totalItems = filteredMachines.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedMachines = filteredMachines.slice(startIndex, endIndex);

  // Soft Delete handler
  const handleConfirmDelete = async () => {
    if (!deletingMachine) return;
    setIsDeleting(true);
    try {
      await machinesApi.delete(deletingMachine.id);
      setMachines((prev) => prev.filter((m) => m.id !== deletingMachine.id));
      if (selectedMachine?.id === deletingMachine.id) {
        setSelectedMachine(null);
      }
      setDeletingMachine(null);
    } catch (err) {
      console.error('Failed to soft delete machine:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-10">
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
            {isOem ? 'All machines' : 'My machines'}
          </h1>
          <p className="text-xs text-[#888888] mt-0.5">
            {isOem
              ? 'Every Foodie machine across all clients.'
              : `Commercial composter units assigned to ${user?.company_name || 'your facility'}.`}
          </p>
        </div>

        {/* Action Button: + Add machine (OEM only) */}
        {isOem && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddMachineOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Add machine</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Top Metric Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Total Machines */}
        <div className="bg-white rounded-xl border border-[#E3E4E6] p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-[#171717] tracking-tight shrink-0">
            {totalCount}
          </span>
          <span className="text-xs text-[#6B7280] font-medium shrink-0">
            Machines
          </span>
        </div>

        {/* Card 2: Running Machines */}
        <div className="bg-white rounded-xl border border-[#E3E4E6] p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-[#171717] tracking-tight shrink-0">
            {runningCount}
          </span>
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#EAFBF1] text-[#0A7135] border border-[#B7F4CE] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C951]" />
            <span>Running</span>
          </span>
        </div>

        {/* Card 3: Idle Machines */}
        <div className="bg-white rounded-xl border border-[#E3E4E6] p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-[#171717] tracking-tight shrink-0">
            {idleCount}
          </span>
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Idle</span>
          </span>
        </div>

        {/* Card 4: Maintenance Machines */}
        <div className="bg-white rounded-xl border border-[#E3E4E6] p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-[#171717] tracking-tight shrink-0">
            {maintenanceCount}
          </span>
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Maintenance</span>
          </span>
        </div>
      </div>

      {/* 3. Search & Filter Bar Container */}
      <div className="bg-white rounded-xl border border-[#E3E4E6] p-3 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search serial number, client or model"
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#171717] placeholder-[#9CA3AF] text-xs focus:outline-none focus:border-[#171717] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280] font-medium text-[11px]">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#171717] font-semibold text-xs cursor-pointer focus:outline-none focus:border-[#171717]"
              >
                <option value="All">All</option>
                <option value="Running">Running</option>
                <option value="Idle">Idle</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Offline">Offline</option>
              </select>
            </div>

            {/* Client Dropdown (OEM only) */}
            {isOem && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#6B7280] font-medium text-[11px]">Client</span>
                <select
                  value={clientFilter}
                  onChange={(e) => {
                    setClientFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#171717] font-semibold text-xs cursor-pointer focus:outline-none focus:border-[#171717] max-w-[180px] truncate"
                >
                  <option value="All clients">All clients</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.company_name}>
                      {org.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Location Dropdown (Site / Location wise) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B7280] font-medium text-[11px]">Location</span>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#171717] font-semibold text-xs cursor-pointer focus:outline-none focus:border-[#171717] max-w-[180px] truncate"
              >
                <option value="All locations">All locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* More filters Button */}
            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                showMoreFilters
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#171717] hover:bg-[#F9FAFB]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More filters</span>
            </button>
          </div>
        </div>

        {/* Expandable More Filters Row */}
        {showMoreFilters && (
          <div className="pt-3 border-t border-[#F3F4F6] flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280] font-medium">Model filter:</span>
              <div className="flex items-center gap-1.5">
                {['All', 'Foodie F25', 'Foodie F100', 'Foodie F500', 'Foodie F1000'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModelFilter(m);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      modelFilter === m
                        ? 'bg-[#E32032] text-white'
                        : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {(searchQuery ||
              statusFilter !== 'All' ||
              clientFilter !== 'All clients' ||
              locationFilter !== 'All states' ||
              modelFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setClientFilter('All clients');
                  setLocationFilter('All states');
                  setModelFilter('All');
                  setCurrentPage(1);
                }}
                className="text-xs text-[#E32032] font-semibold hover:underline cursor-pointer ml-auto"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Machines Main Data Table */}
      <div className="bg-white rounded-xl border border-[#E3E4E6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-bold text-[#6B7280]">
                <th className="py-3 px-4 font-semibold">Serial Number</th>
                <th className="py-3 px-4 font-semibold">Model</th>
                <th className="py-3 px-4 font-semibold">Client</th>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold">Lease start date</th>
                <th className="py-3 px-4 font-semibold">Connectivity</th>
                <th className="py-3 px-4 font-semibold">Machine status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#E32032]" />
                      <span>Loading fleet machines from database...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedMachines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                    <Cpu className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="font-bold text-[#171717]">No machines match current filters</p>
                    <p className="text-xs text-[#888888] mt-1">
                      Try clearing search or adjusting your status, client, or location dropdowns.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedMachines.map((m) => {
                  const isOnline = m.connectivity_status?.toLowerCase() === 'online';
                  const opStatus = m.operational_status || 'Idle';

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-[#F9FAFB] transition-colors"
                    >
                      {/* Serial Number (Clickable in red underline) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedMachine(m)}
                          className="font-bold text-[#E32032] underline hover:text-[#C1121F] cursor-pointer whitespace-nowrap font-mono inline-block"
                        >
                          {m.machine_code || m.serial_number}
                        </button>
                      </td>

                      {/* Model & Capacity */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#171717]">{m.model}</div>
                        {m.capacity && (
                          <div className="text-[11px] text-[#6B7280] mt-0.5">
                            {m.capacity}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="py-3 px-4 font-bold text-[#171717]">
                        {m.company_name || 'Unassigned'}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-[#171717]">
                        {formatLocation(m)}
                      </td>

                      {/* Lease start date */}
                      <td className="py-3 px-4 text-[#171717]">
                        {formatDate(m.lease_start_date)}
                      </td>

                      {/* Connectivity */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isOnline
                              ? 'bg-[#EAFBF1] text-[#0A7135] border-[#B7F4CE]'
                              : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
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

                      {/* Machine status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            opStatus === 'Running'
                              ? 'bg-[#EAFBF1] text-[#0A7135] border-[#B7F4CE]'
                              : opStatus === 'Idle'
                              ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                              : opStatus === 'Maintenance'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                              : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              opStatus === 'Running'
                                ? 'bg-[#00C951]'
                                : opStatus === 'Idle'
                                ? 'bg-amber-500'
                                : opStatus === 'Maintenance'
                                ? 'bg-blue-500'
                                : 'bg-[#9CA3AF]'
                            }`}
                          />
                          <span>{opStatus}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="relative inline-block text-left" ref={activeMenuId === m.id ? menuContainerRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === m.id ? null : m.id);
                            }}
                            className="p-1 rounded-md text-[#9CA3AF] hover:text-[#171717] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {activeMenuId === m.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 z-20 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMachine(m);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-[#171717] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                                <span>View details</span>
                              </button>

                              {isOem && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMachine(m);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-[#171717] hover:bg-[#F9FAFB] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-[#6B7280]" />
                                    <span>Edit machine</span>
                                  </button>

                                  <div className="border-t border-[#F3F4F6] my-1" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeletingMachine(m);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-[#E32032] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-[#E32032]" />
                                    <span>Delete machine</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination & Footer */}
        <div className="px-5 py-3.5 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6B7280] bg-white select-none">
          {/* Left Controls: Page input, Rows per page, Showing counter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Page</span>
              <span className="font-semibold text-[#171717] px-2 py-0.5 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                {currentPage}
              </span>
              <span>of {totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 rounded border border-[#E5E7EB] bg-white text-[#171717] font-semibold text-xs cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="text-[11px] text-[#888888]">
              Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} machines
            </div>
          </div>

          {/* Right Controls: Numeric Page Buttons with Prev / Next */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Numeric Page Buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#FFF0F0] border border-[#FCA5A5] text-[#E32032] font-bold'
                      : 'bg-white border border-[#E5E7EB] text-[#171717] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#171717] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Popup */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Drawers & Modals */}
      <AddMachineDrawer
        isOpen={isAddMachineOpen}
        onClose={() => setIsAddMachineOpen(false)}
        onSuccess={(newMachine) => {
          setMachines((prev) => [newMachine, ...prev]);
          setToast({
            message: `Machine ${newMachine.serial_number || newMachine.machine_code} added successfully!`,
            type: 'success',
          });
        }}
      />

      <MachineDetailDrawer
        isOpen={!!selectedMachine}
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
        onEdit={(m) => {
          setSelectedMachine(null);
          setEditingMachine(m);
        }}
        onDelete={(m) => {
          setSelectedMachine(null);
          setDeletingMachine(m);
        }}
      />

      <EditMachineDrawer
        isOpen={!!editingMachine}
        machine={editingMachine}
        onClose={() => setEditingMachine(null)}
        onSuccess={(updated) => {
          setMachines((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
          setToast({
            message: `Machine ${updated.serial_number || updated.machine_code} updated successfully!`,
            type: 'success',
          });
        }}
      />

      <DeleteMachineModal
        isOpen={!!deletingMachine}
        machine={deletingMachine}
        onClose={() => setDeletingMachine(null)}
        onConfirm={async () => {
          await handleConfirmDelete();
          setToast({
            message: 'Machine removed from fleet inventory successfully.',
            type: 'info',
          });
        }}
        isDeleting={isDeleting}
      />
    </div>
  );
};
