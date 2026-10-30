import React, { useState, useEffect } from 'react';
import { 
  Cpu, Plus, Trash2, CheckCircle2, Shield, Eye, Edit2, X, Lock, Save, Loader2, 
  HardDrive, Network, FileText
} from 'lucide-react';
import { InputField } from '../components/common/InputField';
import { SelectField } from '../components/common/SelectField';
import { machinesApi, sitesApi, orgsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Machine, MachineFormData, Site, Organization } from '../types';

const MACHINE_MODELS = [
  { value: 'Foodie F25', label: 'Foodie F25 — 25 kg/day capacity', capacity: '25 kg/day' },
  { value: 'Foodie F100', label: 'Foodie F100 — 100 kg/day capacity', capacity: '100 kg/day' },
  { value: 'Foodie F500', label: 'Foodie F500 — 500 kg/day capacity', capacity: '500 kg/day' },
  { value: 'Foodie F1000', label: 'Foodie F1000 — 1000 kg/day capacity', capacity: '1000 kg/day' },
];

const LEASE_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active — Currently operating under lease' },
  { value: 'Pending', label: 'Pending — Awaiting delivery or commissioning' },
  { value: 'Expired', label: 'Expired — Lease term concluded' },
  { value: 'Terminated', label: 'Terminated — Agreement cancelled early' },
];

const CONNECTIVITY_OPTIONS = [
  { value: 'Offline', label: 'Offline — Default status / Standby' },
  { value: 'Online', label: 'Online — Connected to cloud broker' },
];

export const MachineOnboardingPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for Creating New Machine & Lease
  const initialForm: MachineFormData = {
    machine_code: '',
    serial_number: '',
    model: 'Foodie F25',
    hardware_version: 'v2.1',
    plc_ip: '192.168.1.20',
    organization_id: '',
    site_id: '',
    location_label: '',
    lease_start_date: new Date().toISOString().split('T')[0],
    lease_end_date: '',
    lease_status: 'Active',
    lease_reference: '',
    manufacture_date: 'Oct 2026',
    warranty_expiry_date: 'Oct 2028',
    connectivity_status: 'Offline',
  };

  const [formData, setFormData] = useState<MachineFormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof MachineFormData, string>>>({});

  // Modal State for Viewing & Editing an Existing Machine
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'view' | 'edit'>('view');
  const [editFormData, setEditFormData] = useState<{
    serial_number: string;
    model: string;
    hardware_version: string;
    plc_ip: string;
    organization_id: string;
    site_id: string;
    location_label: string;
    lease_start_date: string;
    lease_end_date: string;
    lease_status: string;
    lease_reference: string;
    manufacture_date: string;
    warranty_expiry_date: string;
    connectivity_status: string;
    is_active: boolean;
  }>({
    serial_number: '',
    model: 'Foodie F25',
    hardware_version: 'v2.1',
    plc_ip: '',
    organization_id: '',
    site_id: '',
    location_label: '',
    lease_start_date: '',
    lease_end_date: '',
    lease_status: 'Active',
    lease_reference: '',
    manufacture_date: '',
    warranty_expiry_date: '',
    connectivity_status: 'Online',
    is_active: true,
  });
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof MachineFormData, string>>>({});

  // Load live machines, sites, and organizations from PostgreSQL
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [liveMachines, liveSites, liveOrgs] = await Promise.all([
        machinesApi.getAll(),
        sitesApi.getAll(),
        orgsApi.getAll(),
      ]);
      setMachines(liveMachines);
      setSites(liveSites);
      setOrgs(liveOrgs);

      if (liveOrgs.length > 0 && !formData.organization_id) {
        setFormData((prev) => ({ ...prev, organization_id: liveOrgs[0].id }));
      }
      if (liveSites.length > 0 && !formData.site_id) {
        setFormData((prev) => ({ ...prev, site_id: liveSites[0].id }));
      }
    } catch (err) {
      console.error('Failed to load data from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isOem = currentUser?.role === 'OEM_MANAGER';

  const orgOptions = orgs.map((o) => ({
    value: o.id,
    label: `${o.company_name} (${o.client_code})`,
  }));

  const siteOptions = sites.map((s) => ({
    value: s.id,
    label: `${s.site_name} (${s.site_code})`,
  }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof MachineFormData, string>> = {};

    if (!formData.machine_code.trim()) {
      errs.machine_code = 'Machine Code / Asset ID is required (e.g. M16)';
    } else if (!/^[A-Za-z0-9-_]{2,20}$/.test(formData.machine_code.trim())) {
      errs.machine_code = 'Machine Code must be 2-20 alphanumeric characters (hyphens allowed)';
    } else {
      const normalizedCode = formData.machine_code.trim().toUpperCase();
      const isDuplicate = machines.some(
        (m) => m.machine_code.trim().toUpperCase() === normalizedCode
      );
      if (isDuplicate) {
        errs.machine_code = `Machine Code "${normalizedCode}" is already registered in the fleet.`;
      }
    }

    if (!formData.serial_number.trim()) {
      errs.serial_number = 'Serial number is required (from machine metal plate)';
    } else {
      const normalizedSerial = formData.serial_number.trim().toUpperCase();
      const isDuplicateSerial = machines.some(
        (m) => m.serial_number.trim().toUpperCase() === normalizedSerial
      );
      if (isDuplicateSerial) {
        errs.serial_number = `Serial number "${normalizedSerial}" is already assigned to another machine.`;
      }
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!formData.plc_ip.trim()) {
      errs.plc_ip = 'PLC Controller IP is required';
    } else if (!ipRegex.test(formData.plc_ip.trim())) {
      errs.plc_ip = 'Enter a valid IPv4 address (e.g. 192.168.1.20)';
    }

    if (!formData.organization_id) {
      errs.organization_id = 'Please select a leasing client organization';
    }

    if (!formData.site_id) {
      errs.site_id = 'Please select a deployment facility site';
    }

    if (!formData.lease_start_date) {
      errs.lease_start_date = 'Lease start date is required';
    }

    if (formData.lease_start_date && formData.lease_end_date) {
      if (new Date(formData.lease_end_date) < new Date(formData.lease_start_date)) {
        errs.lease_end_date = 'Lease end date must be after lease start date';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedModelObj = MACHINE_MODELS.find((m) => m.value === formData.model);
      const capacity = selectedModelObj ? selectedModelObj.capacity : '100 kg/day';

      const newMachine = await machinesApi.create({
        machine_code: formData.machine_code.trim().toUpperCase(),
        serial_number: formData.serial_number.trim().toUpperCase(),
        model: formData.model,
        capacity,
        hardware_version: formData.hardware_version.trim() || 'v2.1',
        plc_ip: formData.plc_ip.trim(),
        organization_id: formData.organization_id,
        site_id: formData.site_id,
        location_label: formData.location_label.trim() || undefined,
        lease_start_date: formData.lease_start_date,
        lease_end_date: formData.lease_end_date || undefined,
        lease_status: formData.lease_status,
        lease_reference: formData.lease_reference.trim() || undefined,
        manufacture_date: formData.manufacture_date.trim() || undefined,
        warranty_expiry_date: formData.warranty_expiry_date.trim() || undefined,
        connectivity_status: formData.connectivity_status,
      });

      await loadData();
      setFormData({
        ...initialForm,
        organization_id: orgs.length > 0 ? orgs[0].id : '',
        site_id: sites.length > 0 ? sites[0].id : '',
      });
      setErrors({});
      setSuccessMessage(`Composter "${newMachine.machine_code}" onboarded and lease recorded successfully in PostgreSQL!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4500);
    } catch (err: any) {
      console.error('Error creating machine:', err);
      setErrors({
        machine_code: err.message || 'Failed to onboard machine to PostgreSQL',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open View Modal (Read-only Details Tab)
  const handleOpenView = (m: Machine) => {
    setEditingMachine(m);
    setActiveModalTab('view');
    setEditFormData({
      serial_number: m.serial_number,
      model: m.model,
      hardware_version: m.hardware_version || '',
      plc_ip: m.plc_ip || '',
      organization_id: m.organization_id || (orgs.length > 0 ? orgs[0].id : ''),
      site_id: m.site_id || (sites.length > 0 ? sites[0].id : ''),
      location_label: m.location_label || '',
      lease_start_date: m.lease_start_date || '',
      lease_end_date: m.lease_end_date || '',
      lease_status: m.lease_status,
      lease_reference: m.lease_reference || '',
      manufacture_date: m.manufacture_date || '',
      warranty_expiry_date: m.warranty_expiry_date || '',
      connectivity_status: m.connectivity_status,
      is_active: m.is_active,
    });
    setEditErrors({});
  };

  // Open Edit Modal (Editable Form Tab)
  const handleOpenEdit = (m: Machine) => {
    setEditingMachine(m);
    setActiveModalTab('edit');
    setEditFormData({
      serial_number: m.serial_number,
      model: m.model,
      hardware_version: m.hardware_version || '',
      plc_ip: m.plc_ip || '',
      organization_id: m.organization_id || (orgs.length > 0 ? orgs[0].id : ''),
      site_id: m.site_id || (sites.length > 0 ? sites[0].id : ''),
      location_label: m.location_label || '',
      lease_start_date: m.lease_start_date || '',
      lease_end_date: m.lease_end_date || '',
      lease_status: m.lease_status,
      lease_reference: m.lease_reference || '',
      manufacture_date: m.manufacture_date || '',
      warranty_expiry_date: m.warranty_expiry_date || '',
      connectivity_status: m.connectivity_status,
      is_active: m.is_active,
    });
    setEditErrors({});
  };

  // Save Edit Changes (Machine Code is strictly NOT editable)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;

    const errs: Partial<Record<keyof MachineFormData, string>> = {};
    if (!editFormData.serial_number.trim()) {
      errs.serial_number = 'Serial number is required';
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!editFormData.plc_ip.trim() || !ipRegex.test(editFormData.plc_ip.trim())) {
      errs.plc_ip = 'Valid IPv4 address is required';
    }

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    try {
      const selectedModelObj = MACHINE_MODELS.find((m) => m.value === editFormData.model);
      const capacity = selectedModelObj ? selectedModelObj.capacity : editingMachine.capacity;

      const updated = await machinesApi.update(editingMachine.id, {
        serial_number: editFormData.serial_number.trim().toUpperCase(),
        model: editFormData.model,
        capacity,
        hardware_version: editFormData.hardware_version.trim() || undefined,
        plc_ip: editFormData.plc_ip.trim(),
        organization_id: editFormData.organization_id,
        site_id: editFormData.site_id,
        location_label: editFormData.location_label.trim() || undefined,
        lease_start_date: editFormData.lease_start_date || undefined,
        lease_end_date: editFormData.lease_end_date || undefined,
        lease_status: editFormData.lease_status,
        lease_reference: editFormData.lease_reference.trim() || undefined,
        manufacture_date: editFormData.manufacture_date.trim() || undefined,
        warranty_expiry_date: editFormData.warranty_expiry_date.trim() || undefined,
        connectivity_status: editFormData.connectivity_status,
        is_active: editFormData.is_active,
      });

      await loadData();
      setEditingMachine(null);
      setSuccessMessage(`Machine "${updated.machine_code}" updated successfully in PostgreSQL!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setEditErrors({ serial_number: err.message || 'Failed to update machine' });
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (window.confirm(`Are you sure you want to decommission and remove machine "${code}" from fleet inventory?`)) {
      try {
        await machinesApi.delete(id);
        await loadData();
        setSuccessMessage(`Machine "${code}" decommissioned successfully.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch (err: any) {
        alert('Failed to remove machine: ' + err.message);
      }
    }
  };

  // If not OEM Manager, display security guard notice
  if (!isOem) {
    return (
      <div className="bg-white border border-[#E3E4E6] rounded-xl p-8 max-w-xl mx-auto my-12 text-center shadow-xs">
        <div className="w-12 h-12 bg-red-50 text-[#E32032] rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#171717]">OEM Asset Manager Scope Required</h2>
        <p className="text-xs text-[#666666] mt-2 leading-relaxed">
          Machine hardware onboarding, PLC network provisioning, and commercial client lease agreements are strictly restricted to 
          <strong> PowerTech Energy OEM Asset Managers</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Clean Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E3E4E6]">
        <div>
          <h1 className="text-xl font-extrabold text-[#171717] flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#E32032]" />
            Machine Onboarding & Client Lease Management
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Provision physical composter hardware, configure PLC network connectivity, and assign client lease terms.
          </p>
        </div>

        <div className="text-xs text-[#666666] bg-white border border-[#E3E4E6] px-3 py-1.5 rounded-lg flex items-center gap-2 self-start">
          <span>Fleet Assets:</span>
          <strong className="text-[#171717] font-bold">{machines.length} Total Units</strong>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[#D7FFE6] border border-[#00C951] text-[#0A7135] px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Two-Section Onboarding Form (Hardware Specs + Lease Terms) */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#E32032]" />
            <h2 className="text-sm font-bold text-[#171717]">Onboard New Composter & Provision Lease</h2>
          </div>
          <span className="text-[11px] text-[#666666] font-medium">Fields marked with * are required</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {/* Section 1: Technical Machine Hardware Specifications */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-[#E3E4E6]">
              <HardDrive className="w-4 h-4 text-[#E32032]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                1. Machine Technical & Controller Specifications
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputField
                label="Machine Code / Asset ID"
                required
                placeholder="e.g. M16 or FOODIE-102"
                value={formData.machine_code}
                onChange={(e) => setFormData({ ...formData, machine_code: e.target.value.toUpperCase() })}
                error={errors.machine_code}
                helperText="Permanent identifier across telemetry"
              />

              <InputField
                label="Physical Serial Number"
                required
                placeholder="e.g. FD100-0048"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.toUpperCase() })}
                error={errors.serial_number}
                helperText="Stamped on machine electrical rating plate"
              />

              <SelectField
                label="Composter Model"
                required
                options={MACHINE_MODELS.map((m) => ({ value: m.value, label: m.label }))}
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
              <InputField
                label="PLC Controller IP Address"
                required
                placeholder="e.g. 192.168.1.20"
                value={formData.plc_ip}
                onChange={(e) => setFormData({ ...formData, plc_ip: e.target.value })}
                error={errors.plc_ip}
                helperText="Siemens S7-1200 Modbus IP"
              />

              <InputField
                label="Hardware Build Version"
                placeholder="e.g. v2.1"
                value={formData.hardware_version}
                onChange={(e) => setFormData({ ...formData, hardware_version: e.target.value })}
              />

              <InputField
                label="Manufacture Date"
                placeholder="e.g. Oct 2026"
                value={formData.manufacture_date}
                onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
              />

              <InputField
                label="Warranty Expiry Date"
                placeholder="e.g. Oct 2028"
                value={formData.warranty_expiry_date}
                onChange={(e) => setFormData({ ...formData, warranty_expiry_date: e.target.value })}
              />
            </div>
          </div>

          {/* Section 2: Commercial Lease Terms & Site Deployment */}
          <div>
            <div className="flex items-center gap-2 pb-2 mb-4 border-b border-[#E3E4E6]">
              <FileText className="w-4 h-4 text-[#00C951]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                2. Client Commercial Lease & Facility Deployment
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                label="Client Organization"
                required
                options={orgOptions}
                value={formData.organization_id}
                onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                error={errors.organization_id}
              />

              <SelectField
                label="Deployment Facility Site"
                required
                options={siteOptions}
                value={formData.site_id}
                onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                error={errors.site_id}
              />

              <InputField
                label="Location on Site / Bay"
                placeholder="e.g. Carpark Bay 2 / Kitchen Dock"
                value={formData.location_label}
                onChange={(e) => setFormData({ ...formData, location_label: e.target.value })}
                helperText="Physical positioning at facility"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
              <InputField
                label="Lease Start Date"
                required
                type="date"
                value={formData.lease_start_date}
                onChange={(e) => setFormData({ ...formData, lease_start_date: e.target.value })}
                error={errors.lease_start_date}
              />

              <InputField
                label="Lease End Date"
                type="date"
                value={formData.lease_end_date}
                onChange={(e) => setFormData({ ...formData, lease_end_date: e.target.value })}
                error={errors.lease_end_date}
                helperText="Leave blank for ongoing contract"
              />

              <SelectField
                label="Lease Status"
                required
                options={LEASE_STATUS_OPTIONS}
                value={formData.lease_status}
                onChange={(e) => setFormData({ ...formData, lease_status: e.target.value })}
              />

              <InputField
                label="Contract / Lease Reference"
                placeholder="e.g. LSE-2026-0042-D"
                value={formData.lease_reference}
                onChange={(e) => setFormData({ ...formData, lease_reference: e.target.value })}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end pt-4 border-t border-[#E3E4E6]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#E32032] hover:bg-[#C71828] disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Onboarding Composter Asset...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Onboard Composter & Provision Lease</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Fleet Asset Register Table */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171717]">All Machines · Asset & Lease Register</h2>
            <p className="text-[11px] text-[#666666]">
              Real-time hardware inventory, controller IP assignments, and customer commercial leases
            </p>
          </div>
          <span className="text-xs font-bold text-[#666666] bg-white border border-[#E3E4E6] px-2.5 py-1 rounded">
            {machines.length} Machines
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E3E4E6] text-[11px] font-bold text-[#666666] uppercase tracking-wider">
                <th className="py-3 px-5">Asset ID</th>
                <th className="py-3 px-5">Model / Capacity</th>
                <th className="py-3 px-5">Serial & PLC IP</th>
                <th className="py-3 px-5">Client & Site Location</th>
                <th className="py-3 px-5">Lease Term</th>
                <th className="py-3 px-5">Lease Status</th>
                <th className="py-3 px-5">Connectivity</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E4E6] text-xs text-[#171717]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#666666]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#E32032]" />
                      <span>Loading fleet asset register from PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : machines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#666666]">
                    No composter assets found. Onboard the first unit above.
                  </td>
                </tr>
              ) : (
                machines.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6] text-[#171717]">
                          {m.machine_code}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {m.hardware_version}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div>
                        <span className="font-bold text-[#171717]">{m.model}</span>
                        <span className="text-[11px] text-[#666666] block">{m.capacity}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div>
                        <span className="font-mono text-xs font-semibold text-slate-700">{m.serial_number}</span>
                        <span className="text-[11px] text-slate-500 font-mono block flex items-center gap-1">
                          <Network className="w-3 h-3 text-slate-400" />
                          {m.plc_ip}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div>
                        <span className="font-semibold text-[#171717] block">
                          {m.company_name || 'Green Valley Foods'}
                        </span>
                        <span className="text-[11px] text-[#666666] block">
                          {m.site_name || 'Assigned Site'} {m.location_label ? `(${m.location_label})` : ''}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-[#666666]">
                      <span className="text-[11px] block">
                        {m.lease_start_date || 'No start date'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        to {m.lease_end_date || 'Ongoing'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                        m.lease_status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : m.lease_status === 'Pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {m.lease_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          m.connectivity_status === 'Online' ? 'bg-[#00C951]' : 'bg-slate-400'
                        }`} />
                        <span className="text-[11px] font-semibold text-[#171717]">
                          {m.connectivity_status}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Action Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenView(m)}
                          className="text-slate-600 hover:text-[#171717] p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="View Asset & Lease Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>

                        {/* Edit Action Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          className="text-[#E32032] hover:text-[#C71828] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Edit Asset / Lease Terms"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Decommission / Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id, m.machine_code)}
                          className="text-slate-400 hover:text-[#E32032] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Decommission Machine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal with Separate View Tab & Edit Tab */}
      {editingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-lg w-full max-w-xl overflow-hidden animate-fadeIn">
            {/* Modal Header & Tabs */}
            <div className="px-6 pt-4 pb-0 border-b border-[#E3E4E6] bg-[#FAFAFA]">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#E32032]" />
                  <h3 className="text-sm font-bold text-[#171717]">
                    {editingMachine.model}
                  </h3>
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                    {editingMachine.machine_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMachine(null)}
                  className="text-[#666666] hover:text-[#171717] p-1 rounded cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Distinct Tab Bar: View Tab vs Edit Tab */}
              <div className="flex items-center gap-6 text-xs font-bold border-b border-transparent -mb-px">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('view')}
                  className={`pb-2.5 px-1 flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                    activeModalTab === 'view'
                      ? 'border-[#E32032] text-[#E32032]'
                      : 'border-transparent text-[#666666] hover:text-[#171717]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('edit')}
                  className={`pb-2.5 px-1 flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                    activeModalTab === 'edit'
                      ? 'border-[#E32032] text-[#E32032]'
                      : 'border-transparent text-[#666666] hover:text-[#171717]'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Asset & Lease</span>
                </button>
              </div>
            </div>

            {/* TAB 1: READ-ONLY VIEW TAB */}
            {activeModalTab === 'view' && (
              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Machine Code
                    </span>
                    <span className="text-xs font-mono font-bold text-[#171717] mt-1 block">
                      {editingMachine.machine_code}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Serial Number
                    </span>
                    <span className="text-xs font-mono font-bold text-[#171717] mt-1 block">
                      {editingMachine.serial_number}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Model & Rated Capacity
                    </span>
                    <span className="text-xs font-bold text-[#171717] mt-1 block">
                      {editingMachine.model} ({editingMachine.capacity})
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      PLC Controller IP
                    </span>
                    <span className="text-xs font-mono font-bold text-[#171717] mt-1 block">
                      {editingMachine.plc_ip} ({editingMachine.hardware_version})
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                    Assigned Customer Organization
                  </span>
                  <span className="text-xs font-bold text-[#171717] mt-1 block">
                    {editingMachine.company_name} ({editingMachine.client_code})
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                    Deployment Site & Placement
                  </span>
                  <span className="text-xs text-[#171717] mt-1 block">
                    {editingMachine.site_name} ({editingMachine.site_code})
                    {editingMachine.location_label && ` — Location: ${editingMachine.location_label}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Lease Term
                    </span>
                    <span className="text-xs font-medium text-[#171717] mt-1 block">
                      {editingMachine.lease_start_date} to {editingMachine.lease_end_date || 'Ongoing'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Lease Status
                    </span>
                    <span className="text-xs font-bold text-[#171717] mt-1 block">
                      {editingMachine.lease_status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E3E4E6] mt-2">
                  <span className="text-[11px] text-[#666666]">
                    Verified asset in PostgreSQL
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMachine(null)}
                      className="px-4 py-2 border border-[#E3E4E6] rounded-lg text-xs font-bold text-[#666666] hover:bg-slate-50 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('edit')}
                      className="bg-[#E32032] hover:bg-[#C71828] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit This Asset</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITABLE FORM TAB */}
            {activeModalTab === 'edit' && (
              <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                {/* Machine Code: Immutable */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#171717] flex items-center justify-between">
                    <span>Machine Code (Asset ID)</span>
                    <span className="text-[10px] text-[#666666] font-medium flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                      <Lock className="w-3 h-3 text-[#666666]" /> Non-editable
                    </span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingMachine.machine_code}
                    className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-[#E3E4E6] rounded-lg font-mono font-bold text-slate-500 cursor-not-allowed select-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Serial Number"
                    required
                    value={editFormData.serial_number}
                    onChange={(e) => setEditFormData({ ...editFormData, serial_number: e.target.value.toUpperCase() })}
                    error={editErrors.serial_number}
                  />

                  <SelectField
                    label="Model"
                    required
                    options={MACHINE_MODELS.map((m) => ({ value: m.value, label: m.label }))}
                    value={editFormData.model}
                    onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="PLC Controller IP"
                    required
                    value={editFormData.plc_ip}
                    onChange={(e) => setEditFormData({ ...editFormData, plc_ip: e.target.value })}
                    error={editErrors.plc_ip}
                  />

                  <SelectField
                    label="Connectivity Status"
                    required
                    options={CONNECTIVITY_OPTIONS}
                    value={editFormData.connectivity_status}
                    onChange={(e) => setEditFormData({ ...editFormData, connectivity_status: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Client Organization"
                    required
                    options={orgOptions}
                    value={editFormData.organization_id}
                    onChange={(e) => setEditFormData({ ...editFormData, organization_id: e.target.value })}
                  />

                  <SelectField
                    label="Deployment Site"
                    required
                    options={siteOptions}
                    value={editFormData.site_id}
                    onChange={(e) => setEditFormData({ ...editFormData, site_id: e.target.value })}
                  />
                </div>

                <InputField
                  label="Location on Site / Bay"
                  value={editFormData.location_label}
                  onChange={(e) => setEditFormData({ ...editFormData, location_label: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Lease Start Date"
                    type="date"
                    value={editFormData.lease_start_date}
                    onChange={(e) => setEditFormData({ ...editFormData, lease_start_date: e.target.value })}
                  />

                  <InputField
                    label="Lease End Date"
                    type="date"
                    value={editFormData.lease_end_date}
                    onChange={(e) => setEditFormData({ ...editFormData, lease_end_date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Lease Status"
                    required
                    options={LEASE_STATUS_OPTIONS}
                    value={editFormData.lease_status}
                    onChange={(e) => setEditFormData({ ...editFormData, lease_status: e.target.value })}
                  />

                  <InputField
                    label="Contract / Lease Reference"
                    value={editFormData.lease_reference}
                    onChange={(e) => setEditFormData({ ...editFormData, lease_reference: e.target.value })}
                  />
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3E4E6] mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMachine(null)}
                    className="px-4 py-2 border border-[#E3E4E6] rounded-lg text-xs font-bold text-[#666666] hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#E32032] hover:bg-[#C71828] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
