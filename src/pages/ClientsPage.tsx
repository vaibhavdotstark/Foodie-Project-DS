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
  Download,
  Archive,
  Trash2,
  Building2,
  Cpu,
  RefreshCw,
  X,
} from 'lucide-react';
import { orgsApi, machinesApi, usersApi } from '../services/api';
import { AddClientModal } from '../components/clients/AddClientModal';
import { EditClientModal } from '../components/clients/EditClientModal';
import { DeleteClientModal } from '../components/clients/DeleteClientModal';
import { AssignMachineModal } from '../components/clients/AssignMachineModal';
import { AddMachineDrawer } from '../components/machines/AddMachineDrawer';
import { ClientDetailView } from '../components/clients/ClientDetailView';
import { Toast } from '../components/common/Toast';
import type { Organization, Machine, User } from '../types';

export const ClientsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientIdFromUrl = searchParams.get('select');

  // Live Data States
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All locations');

  // Row Selection State for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Row Actions Dropdown Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Modals & Drawers States
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Organization | null>(null);
  const [deletingClient, setDeletingClient] = useState<Organization | null>(null);
  const [deletingClients, setDeletingClients] = useState<Organization[]>([]);
  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isAssignMachineOpen, setIsAssignMachineOpen] = useState(false);

  // Load live data from PostgreSQL API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [orgList, machineList, userList] = await Promise.all([
        orgsApi.getAll().catch(() => []),
        machinesApi.getAll().catch(() => []),
        usersApi.getAll().catch(() => []),
      ]);
      setOrganizations(orgList);
      setMachines(machineList);
      setUsers(userList);

      if (selectedClientIdFromUrl && orgList.length > 0) {
        const found = orgList.find(
          (o) => o.id === selectedClientIdFromUrl || o.client_code === selectedClientIdFromUrl
        );
        if (found) setSelectedClient(found);
      }
    } catch (err) {
      console.error('Failed to load clients data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClientIdFromUrl]);

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

  // Location Formatter: parses suburb & state (e.g. "Mount Isa QLD")
  const formatLocation = (address?: string): string => {
    if (!address) return '—';
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      const matchState = lastPart.match(/(QLD|SA|WA|VIC|TAS|NT|NSW|ACT)/i);
      const suburb = parts[parts.length - 2] || parts[0];
      if (matchState) {
        return `${suburb.replace(/(\d+)/g, '').trim()} ${matchState[0].toUpperCase()}`;
      }
      return `${suburb}, ${lastPart}`;
    }
    return address;
  };

  // Date Formatter: "14 Oct 2026"
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Dynamic unique locations from client organizations
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    organizations.forEach((org) => {
      if (org.billing_address) locSet.add(org.billing_address);
      if (org.shipping_address) locSet.add(org.shipping_address);
    });
    return Array.from(locSet).filter(Boolean);
  }, [organizations]);

  // Filter Pipeline
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        org.client_code.toLowerCase().includes(q) ||
        org.company_name.toLowerCase().includes(q) ||
        (org.contact_poc && org.contact_poc.toLowerCase().includes(q)) ||
        (org.email && org.email.toLowerCase().includes(q)) ||
        (org.billing_address && org.billing_address.toLowerCase().includes(q));

      // 2. Status Filter
      const clientStatus =
        org.status || (org.is_active ? 'Active' : 'Pending');
      const matchesStatus =
        statusFilter === 'All' ||
        clientStatus.toLowerCase() === statusFilter.toLowerCase();

      // 3. Business Type Filter
      const clientType = org.business_type || 'Corporate';
      const matchesType =
        businessTypeFilter === 'All' ||
        clientType.toLowerCase() === businessTypeFilter.toLowerCase();

      // 4. Site / Facility Location Filter
      const matchesLocation =
        locationFilter === 'All locations' ||
        (org.billing_address &&
          org.billing_address.toLowerCase().includes(locationFilter.toLowerCase())) ||
        (org.shipping_address &&
          org.shipping_address.toLowerCase().includes(locationFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesType && matchesLocation;
    });
  }, [organizations, searchQuery, statusFilter, businessTypeFilter, locationFilter]);

  // Pagination Slice
  const totalItems = filteredOrganizations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const paginatedClients = filteredOrganizations.slice(startIndex, endIndex);

  // Checkbox Selection Logic
  const isAllPageSelected =
    paginatedClients.length > 0 &&
    paginatedClients.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedClients.some((c) => c.id === id))
      );
    } else {
      const pageIds = paginatedClients.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Export to CSV
  const handleExportData = (exportItems: Organization[]) => {
    if (exportItems.length === 0) return;
    const headers = [
      'Client ID',
      'Company Name',
      'Business Type',
      'Contact POC',
      'Email',
      'Phone',
      'Location',
      'Status',
      'Onboarding Date',
    ];
    const rows = exportItems.map((c) => [
      c.client_code,
      `"${c.company_name.replace(/"/g, '""')}"`,
      c.business_type || 'Corporate',
      c.contact_poc || '',
      c.email || '',
      c.phone_number || '',
      `"${(c.billing_address || '').replace(/"/g, '""')}"`,
      c.status || (c.is_active ? 'Active' : 'Pending'),
      formatDate(c.created_at),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `powertech_clients_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Archive
  const handleBulkArchive = async () => {
    const selectedClients = organizations.filter((o) => selectedIds.includes(o.id));
    for (const c of selectedClients) {
      try {
        await orgsApi.update(c.id, { is_active: !c.is_active, status: c.is_active ? 'Inactive' : 'Active' });
      } catch (err) {
        console.error('Error toggling client active state:', err);
      }
    }
    await fetchData();
    setSelectedIds([]);
  };

  const handleUnassignMachine = async (machineId: string) => {
    try {
      await machinesApi.unassign(machineId);
      await fetchData();
      setToast({
        message: 'Machine successfully unassigned from client and returned to available fleet.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to unassign machine:', err);
      setToast({
        message: err?.message || 'Failed to unassign machine.',
        type: 'error',
      });
    }
  };

  const handleToggleSelectedClientStatus = async () => {
    if (!selectedClient) return;
    try {
      const nextStatus = selectedClient.is_active ? 'Inactive' : 'Active';
      const updated = await orgsApi.update(selectedClient.id, {
        is_active: !selectedClient.is_active,
        status: nextStatus,
      });
      setSelectedClient(updated);
      setOrganizations((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o))
      );
    } catch (err) {
      console.error('Failed to toggle client status:', err);
    }
  };

  if (selectedClient) {
    const clientMachines = machines.filter((m) => m.organization_id === selectedClient.id);
    return (
      <div className="select-none">
        <ClientDetailView
          client={selectedClient}
          machines={machines}
          users={users}
          onBack={() => {
            setSelectedClient(null);
            setSearchParams({});
          }}
          onEdit={() => setEditingClient(selectedClient)}
          onAssignMachine={() => setIsAssignMachineOpen(true)}
          onUnassignMachine={handleUnassignMachine}
          onDeleteClient={() => setDeletingClient(selectedClient)}
          onToggleStatus={handleToggleSelectedClientStatus}
        />

        <EditClientModal
          isOpen={Boolean(editingClient)}
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={(updatedOrg) => {
            setOrganizations((prev) =>
              prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o))
            );
            setSelectedClient(updatedOrg);
          }}
        />

        <AssignMachineModal
          isOpen={isAssignMachineOpen}
          client={selectedClient}
          assignedMachinesCount={clientMachines.length}
          onClose={() => setIsAssignMachineOpen(false)}
          onSuccess={() => {
            fetchData();
            setToast({
              message: 'Machine(s) assigned to client successfully!',
              type: 'success',
            });
          }}
        />

        <DeleteClientModal
          isOpen={Boolean(deletingClient)}
          client={deletingClient}
          onClose={() => setDeletingClient(null)}
          onSuccess={(deletedIds) => {
            setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
            setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
            setSelectedClient(null);
            setSearchParams({});
            fetchData();
            setToast({
              message: 'Client record archived and assigned machines unassigned successfully.',
              type: 'info',
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto select-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
              Clients
            </h1>
            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              title="Refresh clients list from PostgreSQL"
              className="p-1 rounded-lg text-[#888888] hover:text-[#171717] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#E32032]' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-[#666666] mt-0.5">
            Every client account and the Foodie machines assigned to it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddClientOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Add client</span>
        </button>
      </div>

      {/* 2. Main White Card Container */}
      <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 shadow-xs overflow-hidden">
        {/* Top Filter Bar Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search client ID, company or contact"
              className="w-full bg-[#F8F9FA] border border-[#E3E4E6] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#171717]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer min-w-[100px]"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Business Type Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Business type</span>
            <select
              value={businessTypeFilter}
              onChange={(e) => {
                setBusinessTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer min-w-[100px]"
            >
              <option value="All">All</option>
              <option value="Corporate">Corporate</option>
              <option value="Individual">Individual</option>
            </select>
          </div>

          {/* Location Dropdown (Facility Location wise) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#666666] font-medium whitespace-nowrap">Location</span>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#E3E4E6] rounded-xl px-3 py-2 text-xs font-bold text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer max-w-[200px] truncate"
            >
              <option value="All locations">All locations</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc.length > 25 ? loc.slice(0, 25) + '...' : loc}
                </option>
              ))}
            </select>
          </div>

          {/* More Filters Button */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All');
              setBusinessTypeFilter('All');
              setLocationFilter('All states');
              setSearchQuery('');
            }}
            title="Reset Filters"
            className="flex items-center gap-1.5 px-3 py-2 border border-[#E3E4E6] rounded-xl bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#171717] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#666666]" />
            <span>More filters</span>
          </button>
        </div>

        {/* 3. Selection Banner */}
        {selectedIds.length > 0 && (
          <div className="bg-[#FFF0F0] border border-[#FECACA] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs my-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-[#E32032] text-white flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              <span className="font-bold text-[#171717]">
                {selectedIds.length === 1
                  ? `1 client selected · ${organizations.find((o) => o.id === selectedIds[0])?.company_name || 'Client'}`
                  : `${selectedIds.length} clients selected`}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[#E32032] underline font-bold hover:text-[#C1121F] cursor-pointer ml-1"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleExportData(organizations.filter((o) => selectedIds.includes(o.id)))
                }
                className="px-3 py-1.5 rounded-lg border border-[#E3E4E6] bg-white text-[#171717] hover:bg-[#F9FAFB] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export data</span>
              </button>

              <button
                type="button"
                onClick={handleBulkArchive}
                className="px-3 py-1.5 rounded-lg border border-[#E3E4E6] bg-white text-[#171717] hover:bg-[#F9FAFB] font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const selectedObjs = organizations.filter((o) => selectedIds.includes(o.id));
                  setDeletingClients(selectedObjs);
                  setDeletingClient(selectedObjs.length === 1 ? selectedObjs[0] : null);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E3E4E6] bg-white text-[#E32032] hover:bg-red-50 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#E32032]" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Clients Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280]">
                {/* Select All Checkbox */}
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#E32032] focus:ring-[#E32032] cursor-pointer accent-[#E32032]"
                  />
                </th>
                <th className="py-3 px-3 whitespace-nowrap min-w-[100px]">Client ID</th>
                <th className="py-3 px-3">Company name</th>
                <th className="py-3 px-3 whitespace-nowrap">Business type</th>
                <th className="py-3 px-3 whitespace-nowrap">Point of contact</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Total machines</th>
                <th className="py-3 px-3 whitespace-nowrap">Onboarding date</th>
                <th className="py-3 px-3 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#666666]">
                    <Building2 className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="font-bold text-[#171717]">No clients match the current filters</p>
                    <p className="text-xs text-[#888888] mt-1">
                      Try clearing search or adjusting your status/location dropdowns.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const isSelected = selectedIds.includes(client.id);
                  const clientMachineCount =
                    machines.filter((m) => m.organization_id === client.id).length;
                  const clientStatus =
                    client.status || (client.is_active ? 'Active' : 'Pending');

                  return (
                    <tr
                      key={client.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-[#FFF5F5] hover:bg-[#FFEBEB]'
                          : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(client.id)}
                          className="w-4 h-4 rounded border-[#D1D5DB] text-[#E32032] focus:ring-[#E32032] cursor-pointer accent-[#E32032]"
                        />
                      </td>

                      {/* Client ID (Red Underlined Link) */}
                      <td className="py-3.5 px-3 whitespace-nowrap min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          className="font-bold text-[#E32032] underline hover:text-[#C1121F] cursor-pointer text-left whitespace-nowrap font-mono inline-block break-keep"
                        >
                          {client.client_code}
                        </button>
                      </td>

                      {/* Company Name */}
                      <td className="py-3.5 px-3 font-bold text-[#171717]">
                        {client.company_name}
                      </td>

                      {/* Business Type */}
                      <td className="py-3.5 px-3 text-[#171717] whitespace-nowrap">
                        {client.business_type || 'Corporate'}
                      </td>

                      {/* Point of Contact */}
                      <td className="py-3.5 px-3 text-[#171717] whitespace-nowrap">
                        {client.contact_poc || 'Jordan Smith'}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3 text-[#171717]">
                        {formatLocation(client.billing_address)}
                      </td>

                      {/* Total Machines */}
                      <td className="py-3.5 px-3 text-center font-medium text-[#171717] whitespace-nowrap">
                        {clientMachineCount}
                      </td>

                      {/* Onboarding Date */}
                      <td className="py-3.5 px-3 text-[#6B7280] whitespace-nowrap">
                        {formatDate(client.onboarding_date || client.created_at)}
                      </td>

                      {/* Status Badge with Dot */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            clientStatus === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : clientStatus === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              clientStatus === 'Active'
                                ? 'bg-[#00C951]'
                                : clientStatus === 'Pending'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{clientStatus}</span>
                        </span>
                      </td>

                      {/* Actions Button & Dropdown Menu */}
                      <td className="py-3.5 px-3 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === client.id ? null : client.id);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 text-[#6B7280] hover:text-[#171717] transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Action Menu */}
                        {activeMenuId === client.id && (
                          <div
                            ref={menuContainerRef}
                            className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#E5E7EB] shadow-xl py-1.5 z-40 text-left animate-in fade-in duration-100"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setSelectedClient(client);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>View client</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setEditingClient(client);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>Edit client</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setSelectedClient(client);
                                setIsAssignMachineOpen(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <Cpu className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>Assign machine</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleExportData([client]);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>Export data</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                setActiveMenuId(null);
                                await orgsApi.update(client.id, {
                                  is_active: !client.is_active,
                                  status: client.is_active ? 'Inactive' : 'Active',
                                });
                                await fetchData();
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>Archive</span>
                            </button>

                            <div className="border-t border-[#F3F4F6] my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeletingClient(client);
                                setDeletingClients([]);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[#E32032] hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#E32032]" />
                              <span>Delete client</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div className="pt-4 mt-3 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          {/* Left: Page X of Y */}
          <div className="flex items-center gap-2">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-12 px-2 py-1 border border-[#D1D5DB] rounded-lg text-center font-bold text-[#171717] focus:outline-none focus:border-[#171717]"
            />
            <span>of {totalPages}</span>
          </div>

          {/* Rows per page dropdown */}
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-[#D1D5DB] rounded-lg font-bold text-[#171717] bg-white cursor-pointer focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Center Summary */}
          <div>
            Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} clients
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
              .map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    pageNum === currentPage
                      ? 'bg-[#FFE4E6] text-[#E32032]'
                      : 'hover:bg-slate-100 text-[#171717]'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              title="Last Page"
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

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onSuccess={(newOrg) => {
          fetchData();
          setToast({
            message: `Client ${newOrg.company_name} (${newOrg.client_code}) added successfully!`,
            type: 'success',
          });
        }}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={Boolean(editingClient)}
        client={editingClient}
        onClose={() => setEditingClient(null)}
        onSuccess={(updatedOrg) => {
          setOrganizations((prev) =>
            prev.map((o) => (o.id === updatedOrg.id ? updatedOrg : o))
          );
          setToast({
            message: `Client ${updatedOrg.company_name} updated successfully!`,
            type: 'success',
          });
        }}
      />

      {/* Delete Client Modal */}
      <DeleteClientModal
        isOpen={Boolean(deletingClient || deletingClients.length > 0)}
        client={deletingClient}
        selectedClients={deletingClients}
        onClose={() => {
          setDeletingClient(null);
          setDeletingClients([]);
        }}
        onSuccess={(deletedIds) => {
          setOrganizations((prev) => prev.filter((o) => !deletedIds.includes(o.id)));
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
          fetchData();
          setToast({
            message: `Client record archived and assigned machines unassigned successfully.`,
            type: 'info',
          });
        }}
      />

      {/* Add Machine Drawer */}
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
    </div>
  );
};
