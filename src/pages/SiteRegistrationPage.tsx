import React, { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, CheckCircle2, MapPin, Eye, Edit2, X, Lock, Save, Loader2, Clock, Globe } from 'lucide-react';
import { InputField } from '../components/common/InputField';
import { SelectField } from '../components/common/SelectField';
import { StatusBadge } from '../components/common/StatusBadge';
import { sitesApi, orgsApi } from '../services/api';
import type { Site, SiteFormData, Organization } from '../types';

export const SiteRegistrationPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for Creating New Site
  const initialForm: SiteFormData = {
    organization_id: '',
    site_code: '',
    site_name: '',
    address: '',
    latitude: '',
    longitude: '',
    timezone: 'Australia/Adelaide',
    is_active: true,
  };

  const [formData, setFormData] = useState<SiteFormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormData, string>>>({});

  // Modal State for Viewing & Editing an Existing Site
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'view' | 'edit'>('view');
  const [editFormData, setEditFormData] = useState<{
    site_name: string;
    address: string;
    timezone: string;
    latitude: string;
    longitude: string;
    is_active: boolean;
  }>({
    site_name: '',
    address: '',
    timezone: 'Australia/Adelaide',
    latitude: '',
    longitude: '',
    is_active: true,
  });
  const [editErrors, setEditErrors] = useState<{ site_name?: string; address?: string }>({});

  // Fetch sites and organizations from PostgreSQL on component load
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sitesData, orgsData] = await Promise.all([
        sitesApi.getAll(),
        orgsApi.getAll(),
      ]);
      setSites(sitesData);
      setOrgs(orgsData);
      if (orgsData.length > 0) {
        setFormData((prev) => ({ ...prev, organization_id: prev.organization_id || orgsData[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load sites/orgs from PostgreSQL:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof SiteFormData, string>> = {};

    if (!formData.organization_id.trim()) {
      errs.organization_id = 'Please select a client organization';
    }

    if (!formData.site_code.trim()) {
      errs.site_code = 'Site code is required (e.g. SITE-A)';
    } else if (!/^[A-Za-z0-9-_]{2,20}$/.test(formData.site_code.trim())) {
      errs.site_code = 'Site code must be 2-20 alphanumeric characters (hyphens allowed)';
    } else {
      const normalizedCode = formData.site_code.trim().toUpperCase();
      const isDuplicate = sites.some(
        (s) => s.site_code.trim().toUpperCase() === normalizedCode
      );
      if (isDuplicate) {
        errs.site_code = `Site code "${normalizedCode}" is already registered. Site codes must be unique.`;
      }
    }

    if (!formData.site_name.trim()) {
      errs.site_name = 'Site name is required';
    } else if (formData.site_name.trim().length < 3) {
      errs.site_name = 'Site name must be at least 3 characters';
    }

    if (!formData.address.trim()) {
      errs.address = 'Physical installation address is required';
    }

    if (formData.latitude && isNaN(Number(formData.latitude))) {
      errs.latitude = 'Latitude must be a valid decimal number';
    }

    if (formData.longitude && isNaN(Number(formData.longitude))) {
      errs.longitude = 'Longitude must be a valid decimal number';
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
      const newSite = await sitesApi.create({
        organization_id: formData.organization_id,
        site_code: formData.site_code.trim().toUpperCase(),
        site_name: formData.site_name.trim(),
        address: formData.address.trim(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        timezone: formData.timezone,
        is_active: formData.is_active,
      });

      await loadData();
      setFormData(initialForm);
      setErrors({});
      setSuccessMessage(`Site "${newSite.site_name}" (${newSite.site_code}) registered successfully in PostgreSQL!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving site to PostgreSQL:', err);
      setErrors({
        site_code: err.message || 'Failed to save site to database.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open View Modal (Read-only Details Tab)
  const handleOpenView = (site: Site) => {
    setEditingSite(site);
    setActiveModalTab('view');
    setEditFormData({
      site_name: site.site_name,
      address: site.address,
      timezone: site.timezone,
      latitude: site.latitude !== null && site.latitude !== undefined ? site.latitude.toString() : '',
      longitude: site.longitude !== null && site.longitude !== undefined ? site.longitude.toString() : '',
      is_active: site.is_active,
    });
    setEditErrors({});
  };

  // Open Edit Modal (Editable Form Tab)
  const handleOpenEdit = (site: Site) => {
    setEditingSite(site);
    setActiveModalTab('edit');
    setEditFormData({
      site_name: site.site_name,
      address: site.address,
      timezone: site.timezone,
      latitude: site.latitude !== null && site.latitude !== undefined ? site.latitude.toString() : '',
      longitude: site.longitude !== null && site.longitude !== undefined ? site.longitude.toString() : '',
      is_active: site.is_active,
    });
    setEditErrors({});
  };

  // Save Edit Changes (Site Code is strictly NOT editable)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    const errs: { site_name?: string; address?: string } = {};
    if (!editFormData.site_name.trim()) errs.site_name = 'Site name is required';
    if (!editFormData.address.trim()) errs.address = 'Physical address is required';

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    try {
      const updated = await sitesApi.update(editingSite.id, {
        site_name: editFormData.site_name.trim(),
        address: editFormData.address.trim(),
        timezone: editFormData.timezone,
        latitude: editFormData.latitude ? parseFloat(editFormData.latitude) : null,
        longitude: editFormData.longitude ? parseFloat(editFormData.longitude) : null,
        is_active: editFormData.is_active,
      });

      await loadData();
      setEditingSite(null);
      setSuccessMessage(`Site "${updated.site_name}" updated successfully in PostgreSQL!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setEditErrors({ site_name: err.message || 'Failed to update site in PostgreSQL' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove site: ${name}?`)) {
      try {
        await sitesApi.delete(id);
        await loadData();
      } catch (err: any) {
        alert('Failed to delete site: ' + err.message);
      }
    }
  };

  const orgOptions = orgs.map((o) => ({
    value: o.id,
    label: `${o.company_name} (${o.client_code})`,
  }));

  const timezoneOptions = [
    { value: 'Australia/Adelaide', label: 'Australia / Adelaide (ACST / UTC+9:30)' },
    { value: 'Australia/Brisbane', label: 'Australia / Brisbane (AEST / UTC+10:00)' },
    { value: 'Australia/Sydney', label: 'Australia / Sydney (AEST / UTC+10:00)' },
    { value: 'Australia/Perth', label: 'Australia / Perth (AWST / UTC+8:00)' },
    { value: 'Australia/Darwin', label: 'Australia / Darwin (ACST / UTC+9:30)' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Clean Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E3E4E6]">
        <div>
          <h1 className="text-xl font-extrabold text-[#171717] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#E32032]" />
            Site & Facility Registration
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Register and manage physical composter facilities across client locations.
          </p>
        </div>

        <div className="text-xs text-[#666666] bg-white border border-[#E3E4E6] px-3 py-1.5 rounded-lg flex items-center gap-2 self-start">
          <span>Total Facilities:</span>
          <strong className="text-[#171717] font-bold">{sites.length} Active</strong>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[#D7FFE6] border border-[#00C951] text-[#0A7135] px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Registration Form Card (Create) */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171717]">New Facility Registration</h2>
          <span className="text-[11px] text-[#666666] font-medium">Fields marked with * are required</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label="Client Organization"
              required
              options={orgOptions}
              value={formData.organization_id}
              onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
              error={errors.organization_id}
              helperText="The client enterprise owning this facility"
            />

            <InputField
              label="Site Code"
              required
              placeholder="e.g. SITE-A or SITE-E"
              value={formData.site_code}
              onChange={(e) => setFormData({ ...formData, site_code: e.target.value })}
              error={errors.site_code}
              helperText="Unique uppercase identifier (Permanent ID)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Facility / Site Name"
              required
              placeholder="e.g. Prince Alfred College"
              value={formData.site_name}
              onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
              error={errors.site_name}
            />

            <SelectField
              label="Facility Timezone"
              required
              options={timezoneOptions}
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              error={errors.timezone}
              helperText="Determines batch cycle reporting times"
            />
          </div>

          <InputField
            label="Installation Physical Address"
            required
            placeholder="e.g. 23 Dequetteville Terrace, Kent Town SA 5067"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            error={errors.address}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="GPS Latitude (Optional)"
              placeholder="e.g. -34.921300"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              error={errors.latitude}
            />

            <InputField
              label="GPS Longitude (Optional)"
              placeholder="e.g. 138.621500"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              error={errors.longitude}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E3E4E6] mt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-[#E32032] rounded border-[#E3E4E6] focus:ring-[#E32032]"
              />
              <span className="text-xs font-semibold text-[#171717]">Mark Site as Operational / Active</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#E32032] hover:bg-[#C71828] disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to PostgreSQL...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Register Site</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Live Sites Table (Read, Update, Delete) */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171717]">Registered Sites Database</h2>
            <p className="text-[11px] text-[#666666]">View, edit, or manage client installation facilities</p>
          </div>
          <span className="text-xs font-bold text-[#666666] bg-white border border-[#E3E4E6] px-2.5 py-1 rounded">
            {sites.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E3E4E6] text-[11px] font-bold text-[#666666] uppercase tracking-wider">
                <th className="py-3 px-5">Code</th>
                <th className="py-3 px-5">Site Name</th>
                <th className="py-3 px-5">Physical Address</th>
                <th className="py-3 px-5">Timezone</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E4E6] text-xs text-[#171717]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#666666]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#E32032]" />
                      <span>Loading records from PostgreSQL database...</span>
                    </div>
                  </td>
                </tr>
              ) : sites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#666666]">
                    No sites registered yet. Fill out the form above to add your first facility.
                  </td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5 font-bold font-mono text-[#171717]">{site.site_code}</td>
                    <td className="py-3.5 px-5 font-bold text-[#171717]">{site.site_name}</td>
                    <td className="py-3.5 px-5 text-[#666666]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E32032] flex-shrink-0" />
                        <span>{site.address}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[#666666] text-[11px]">{site.timezone}</td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={site.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Action Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenView(site)}
                          className="text-slate-600 hover:text-[#171717] p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="View Facility Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>

                        {/* Edit Action Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(site)}
                          className="text-[#E32032] hover:text-[#C71828] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Edit Facility"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Action Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(site.id, site.site_name)}
                          className="text-slate-400 hover:text-[#E32032] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Site"
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

      {/* View & Edit Site Modal (Separated View Tab and Edit Tab) */}
      {editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-fadeIn">
            {/* Modal Header & Tabs */}
            <div className="px-6 pt-4 pb-0 border-b border-[#E3E4E6] bg-[#FAFAFA]">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#E32032]" />
                  <h3 className="text-sm font-bold text-[#171717]">
                    {editingSite.site_name}
                  </h3>
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                    {editingSite.site_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
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
                  <span>Edit Facility</span>
                </button>
              </div>
            </div>

            {/* TAB 1: READ-ONLY VIEW TAB */}
            {activeModalTab === 'view' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Site Code
                    </span>
                    <span className="text-xs font-mono font-bold text-[#171717] mt-1 block">
                      {editingSite.site_code}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                      Operational Status
                    </span>
                    <div className="mt-1">
                      <StatusBadge status={editingSite.is_active ? 'active' : 'inactive'} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block">
                    Facility Name
                  </span>
                  <span className="text-xs font-bold text-[#171717] mt-1 block">
                    {editingSite.site_name}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#E32032]" /> Physical Address
                  </span>
                  <span className="text-xs text-[#171717] mt-1 block">
                    {editingSite.address}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> Timezone
                    </span>
                    <span className="text-xs font-medium text-[#171717] mt-1 block">
                      {editingSite.timezone}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500" /> GPS Coordinates
                    </span>
                    <span className="text-xs font-mono text-[#171717] mt-1 block">
                      {editingSite.latitude !== null && editingSite.latitude !== undefined && editingSite.longitude !== null && editingSite.longitude !== undefined
                        ? `${editingSite.latitude}, ${editingSite.longitude}`
                        : 'Not configured'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E3E4E6] mt-2">
                  <span className="text-[11px] text-[#666666]">
                    Registered facility in PostgreSQL
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingSite(null)}
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
                      <span>Edit Facility</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITABLE FORM TAB */}
            {activeModalTab === 'edit' && (
              <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4">
                {/* Site Code: Immutable / Non-editable as requested by sir */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#171717] flex items-center justify-between">
                    <span>Site Code (Permanent Identifier)</span>
                    <span className="text-[10px] text-[#666666] font-medium flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                      <Lock className="w-3 h-3 text-[#666666]" /> Non-editable
                    </span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingSite.site_code}
                    className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-[#E3E4E6] rounded-lg font-mono font-bold text-slate-500 cursor-not-allowed select-none"
                  />
                </div>

                {/* Editable Site Name */}
                <InputField
                  label="Facility / Site Name"
                  required
                  value={editFormData.site_name}
                  onChange={(e) => setEditFormData({ ...editFormData, site_name: e.target.value })}
                  error={editErrors.site_name}
                />

                {/* Editable Address */}
                <InputField
                  label="Physical Address"
                  required
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  error={editErrors.address}
                />

                {/* Editable Timezone */}
                <SelectField
                  label="Facility Timezone"
                  required
                  options={timezoneOptions}
                  value={editFormData.timezone}
                  onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                />

                {/* Editable Coordinates */}
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="GPS Latitude"
                    value={editFormData.latitude}
                    onChange={(e) => setEditFormData({ ...editFormData, latitude: e.target.value })}
                  />
                  <InputField
                    label="GPS Longitude"
                    value={editFormData.longitude}
                    onChange={(e) => setEditFormData({ ...editFormData, longitude: e.target.value })}
                  />
                </div>

                {/* Editable Status */}
                <label className="flex items-center gap-2 cursor-pointer select-none pt-2 border-t border-[#E3E4E6]">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-[#E32032] rounded border-[#E3E4E6] focus:ring-[#E32032]"
                  />
                  <span className="text-xs font-semibold text-[#171717]">Facility is Active</span>
                </label>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3E4E6] mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingSite(null)}
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
