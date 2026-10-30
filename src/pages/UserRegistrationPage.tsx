import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, CheckCircle2, Shield, Phone, Mail, Eye, Edit2, X, Lock, Save, Loader2, Building2 } from 'lucide-react';
import { InputField } from '../components/common/InputField';
import { SelectField } from '../components/common/SelectField';
import { StatusBadge } from '../components/common/StatusBadge';
import { usersApi, sitesApi, orgsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { User, UserRole, UserFormData, Site, Organization } from '../types';

export const UserRegistrationPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOem = currentUser?.role === 'OEM_MANAGER';

  // Form State for Creating New User
  const initialForm: UserFormData = {
    organization_id: '',
    assigned_site_id: '',
    email: '',
    first_name: '',
    last_name: '',
    role: isOem ? 'SITE_ADMIN' : 'OPERATOR',
    phone_number: '',
    password: '',
    confirm_password: '',
  };

  const [formData, setFormData] = useState<UserFormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  // Modal State for Viewing & Editing an Existing User
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'view' | 'edit'>('view');
  const [editFormData, setEditFormData] = useState<{
    first_name: string;
    last_name: string;
    phone_number: string;
    role: UserRole;
    assigned_site_id: string;
    is_active: boolean;
  }>({
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'OPERATOR',
    assigned_site_id: '',
    is_active: true,
  });
  const [editErrors, setEditErrors] = useState<{ first_name?: string; last_name?: string }>({});

  // Load live users, sites, and organizations from PostgreSQL
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [liveUsers, liveSites, liveOrgs] = await Promise.all([
        usersApi.getAll(),
        sitesApi.getAll(),
        orgsApi.getAll(),
      ]);
      setUsers(liveUsers);
      setSites(liveSites);
      setOrgs(liveOrgs);
      if (liveSites.length > 0 && !formData.assigned_site_id) {
        setFormData((prev) => ({ ...prev, assigned_site_id: liveSites[0].id }));
      }
      if (liveOrgs.length > 0 && !formData.organization_id) {
        setFormData((prev) => ({ ...prev, organization_id: liveOrgs[0].id }));
      }
    } catch (err) {
      console.error('Failed to load users/sites/orgs from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setFormData((prev) => ({
      ...prev,
      role: isOem ? 'SITE_ADMIN' : 'OPERATOR',
    }));
  }, [isOem]);

  // Role Options Scoped by Logged-in User Authority
  // OEM Manager can ONLY provision Site Admin (Facility Manager)
  // Site Admin can ONLY provision Operator (Floor Technician)
  const roleOptions: { value: UserRole; label: string }[] = isOem
    ? [
        { value: 'SITE_ADMIN', label: 'Site Admin — Facility manager' },
      ]
    : [
        { value: 'OPERATOR', label: 'Operator — Floor technician' },
      ];

  const editRoleOptions: { value: UserRole; label: string }[] = isOem
    ? roleOptions
    : editingUser?.role === 'SITE_ADMIN'
    ? [{ value: 'SITE_ADMIN', label: 'Site Admin — Facility manager' }]
    : roleOptions;

  // Scoped Users Visible in Management Table
  // OEM Manager can view all system users (OEM, Site Admin, Operator)
  // Site Admin strictly only views and manages Operator accounts for facilities (OEM Manager and Site Admin hidden)
  const visibleUsers = users.filter((u) => {
    if (isOem) {
      return true;
    }
    return u.role === 'OPERATOR';
  });

  const orgOptions = orgs.map((o) => ({
    value: o.id,
    label: `${o.company_name} (${o.client_code})`,
  }));

  const siteOptions = sites.map((s) => ({
    value: s.id,
    label: `${s.site_name} (${s.site_code})`,
  }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof UserFormData, string>> = {};

    if (!formData.first_name.trim()) {
      errs.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      errs.last_name = 'Last name is required';
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!formData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = 'Please enter a valid business email address';
    } else {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const isDuplicate = users.some(
        (u) => u.email.trim().toLowerCase() === normalizedEmail
      );
      if (isDuplicate) {
        errs.email = `An account with email "${formData.email.trim()}" is already registered. Email must be unique.`;
      }
    }

    if (formData.phone_number && !/^\+?[0-9\s-]{8,16}$/.test(formData.phone_number.trim())) {
      errs.phone_number = 'Enter a valid phone number (e.g. +61 411 222 333)';
    }

    if (!formData.password) {
      errs.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    } else if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      errs.password = 'Password must contain at least 1 letter and 1 number';
    }

    if (formData.password !== formData.confirm_password) {
      errs.confirm_password = 'Passwords do not match';
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
      const newUser = await usersApi.create({
        organization_id: formData.role === 'OEM_MANAGER' ? null : formData.organization_id,
        assigned_site_id: formData.role === 'OEM_MANAGER' ? null : formData.assigned_site_id || null,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        role: formData.role,
        phone_number: formData.phone_number.trim() || undefined,
      });

      const freshUsers = await usersApi.getAll();
      setUsers(freshUsers);
      setFormData({
        ...initialForm,
        role: isOem ? 'SITE_ADMIN' : 'OPERATOR',
        assigned_site_id: sites.length > 0 ? sites[0].id : '',
      });
      setErrors({});
      setSuccessMessage(`User "${newUser.first_name} ${newUser.last_name}" saved to PostgreSQL successfully!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error creating user in PostgreSQL:', err);
      setErrors({
        email: err.message || 'Failed to save user to PostgreSQL',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open View Modal (Read-only Details Tab)
  const handleOpenView = (userToView: User) => {
    setEditingUser(userToView);
    setActiveModalTab('view');
    setEditFormData({
      first_name: userToView.first_name,
      last_name: userToView.last_name,
      phone_number: userToView.phone_number || '',
      role: userToView.role,
      assigned_site_id: userToView.assigned_site_id || (sites.length > 0 ? sites[0].id : ''),
      is_active: userToView.is_active,
    });
    setEditErrors({});
  };

  // Open Edit Modal (Editable Form Tab)
  const handleOpenEdit = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setActiveModalTab('edit');
    setEditFormData({
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      phone_number: userToEdit.phone_number || '',
      role: userToEdit.role,
      assigned_site_id: userToEdit.assigned_site_id || (sites.length > 0 ? sites[0].id : ''),
      is_active: userToEdit.is_active,
    });
    setEditErrors({});
  };

  // Save Edit Changes (Email is strictly NOT editable)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const errs: { first_name?: string; last_name?: string } = {};
    if (!editFormData.first_name.trim()) errs.first_name = 'First name is required';
    if (!editFormData.last_name.trim()) errs.last_name = 'Last name is required';

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    try {
      const updated = await usersApi.update(editingUser.id, {
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        phone_number: editFormData.phone_number.trim() || undefined,
        role: editFormData.role,
        assigned_site_id: editFormData.role === 'OEM_MANAGER' ? null : editFormData.assigned_site_id,
        is_active: editFormData.is_active,
      });

      const freshUsers = await usersApi.getAll();
      setUsers(freshUsers);
      setEditingUser(null);
      setSuccessMessage(`User "${updated.first_name} ${updated.last_name}" updated in PostgreSQL!`);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setEditErrors({ first_name: err.message || 'Failed to update user in PostgreSQL' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate user: ${name}?`)) {
      try {
        await usersApi.delete(id);
        const freshUsers = await usersApi.getAll();
        setUsers(freshUsers);
      } catch (err: any) {
        alert('Failed to delete user: ' + err.message);
      }
    }
  };

  const getSiteName = (siteId: string | null): string => {
    if (!siteId) return 'All Sites (OEM Scope)';
    const found = sites.find((s) => s.id === siteId);
    return found ? found.site_name : 'Assigned Site';
  };

  const rolePillColors: Record<UserRole, string> = {
    OEM_MANAGER: 'bg-purple-100 text-purple-800 border-purple-200',
    SITE_ADMIN: 'bg-red-50 text-[#E32032] border-red-200',
    OPERATOR: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Clean Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E3E4E6]">
        <div>
          <h1 className="text-xl font-extrabold text-[#171717] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E32032]" />
            User Management & Access Control
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Manage user accounts, roles, and facility access permissions.
          </p>
        </div>

        <div className="text-xs text-[#666666] bg-white border border-[#E3E4E6] px-3 py-1.5 rounded-lg flex items-center gap-2 self-start">
          <span>{isOem ? 'Active Accounts:' : 'Facility Operators:'}</span>
          <strong className="text-[#171717] font-bold">
            {visibleUsers.length} {isOem ? 'Total' : 'Operators'}
          </strong>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[#D7FFE6] border border-[#00C951] text-[#0A7135] px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* User Registration Form Card (Create) */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#171717]">New User Registration</h2>
          <span className="text-[11px] text-[#666666] font-medium">Fields marked with * are required</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="First Name"
              required
              placeholder="e.g. Sam"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              error={errors.first_name}
            />

            <InputField
              label="Last Name"
              required
              placeholder="e.g. Taylor"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              error={errors.last_name}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Email Address"
              required
              type="email"
              placeholder="e.g. operator@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
              helperText="Used as permanent login identifier"
            />

            <InputField
              label="Phone Number"
              placeholder="e.g. +61 422 111 222"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              error={errors.phone_number}
            />
          </div>

          {/* Role Selection (Scoped by authority) */}
          <SelectField
            label="Role"
            required
            options={roleOptions}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            helperText={
              isOem
                ? 'OEM Asset Managers provision Site Admin (Facility Manager) accounts'
                : 'Site Admins provision facility Operator accounts'
            }
          />

          {/* Organization & Site Scope */}
          {formData.role !== 'OEM_MANAGER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-[#E3E4E6] rounded-lg">
              <SelectField
                label="Client Organization"
                required
                options={orgOptions}
                value={formData.organization_id}
                onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
              />

              <SelectField
                label="Assigned Facility Site"
                required
                options={siteOptions}
                value={formData.assigned_site_id}
                onChange={(e) => setFormData({ ...formData, assigned_site_id: e.target.value })}
                helperText="Facility site managed by this user"
              />
            </div>
          )}

          {/* Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E3E4E6]">
            <InputField
              label="Password"
              required
              type="password"
              placeholder="Min. 8 characters (letters + numbers)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
            />

            <InputField
              label="Confirm Password"
              required
              type="password"
              placeholder="Retype password"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              error={errors.confirm_password}
            />
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-[#E3E4E6]">
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
                  <UserPlus className="w-4 h-4" />
                  <span>Create User Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Live Users Table (Read, Update, Delete) */}
      <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3E4E6] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171717]">
              {isOem ? 'Authorized User Accounts' : 'Facility Operator Accounts'}
            </h2>
            <p className="text-[11px] text-[#666666]">
              {isOem
                ? 'View, edit, or manage client, admin, and operator credentials'
                : 'View, edit, or manage facility operator credentials'}
            </p>
          </div>
          <span className="text-xs font-bold text-[#666666] bg-white border border-[#E3E4E6] px-2.5 py-1 rounded">
            {visibleUsers.length} {isOem ? 'Users' : 'Operators'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E3E4E6] text-[11px] font-bold text-[#666666] uppercase tracking-wider">
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Assigned Facility</th>
                <th className="py-3 px-5">Contact</th>
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
                      <span>Loading authorized users from PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#666666]">
                    {isOem
                      ? 'No authorized users found. Create the first user above.'
                      : 'No operator accounts found. Register a facility operator above.'}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#F8F9FA] transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#171717] text-white text-[10px] font-bold flex items-center justify-center">
                        {u.first_name[0]}
                        {u.last_name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-[#171717]">
                          {u.first_name} {u.last_name}
                        </div>
                        <div className="text-[11px] text-[#666666] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${rolePillColors[u.role]}`}>
                      <Shield className="w-3 h-3" />
                      <span>{u.role === 'OEM_MANAGER' ? 'OEM Manager' : u.role === 'SITE_ADMIN' ? 'Site Admin' : 'Operator'}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-[#666666]">{getSiteName(u.assigned_site_id)}</td>
                  <td className="py-3.5 px-5 text-[#666666]">
                    {u.phone_number ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{u.phone_number}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View Action Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenView(u)}
                        className="text-slate-600 hover:text-[#171717] p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title="View User Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>

                      {/* Edit Action Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="text-[#E32032] hover:text-[#C71828] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* Deactivate / Delete Action Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id, `${u.first_name} ${u.last_name}`)}
                        className="text-slate-400 hover:text-[#E32032] p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Deactivate User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View & Edit User Modal (Separated View Tab and Edit Tab) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3E4E6] rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-fadeIn">
            {/* Modal Header & Tabs */}
            <div className="px-6 pt-4 pb-0 border-b border-[#E3E4E6] bg-[#FAFAFA]">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E32032]" />
                  <h3 className="text-sm font-bold text-[#171717]">
                    {editingUser.first_name} {editingUser.last_name}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                    {editingUser.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
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
                  <span>Edit User</span>
                </button>
              </div>
            </div>

            {/* TAB 1: READ-ONLY VIEW TAB */}
            {activeModalTab === 'view' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-[#E3E4E6]">
                  <div className="w-10 h-10 rounded-full bg-[#171717] text-white flex items-center justify-center font-bold text-xs uppercase">
                    {editingUser.first_name[0] || ''}{editingUser.last_name[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#171717] truncate">
                      {editingUser.first_name} {editingUser.last_name}
                    </h4>
                    <p className="text-[11px] text-[#666666] truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {editingUser.email}
                    </p>
                  </div>
                  <div>
                    <StatusBadge status={editingUser.is_active ? 'active' : 'inactive'} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#E32032]" /> Assigned Role
                    </span>
                    <span className="text-xs font-bold text-[#171717] mt-1.5 block">
                      {editingUser.role === 'OEM_MANAGER'
                        ? 'OEM Manager'
                        : editingUser.role === 'SITE_ADMIN'
                        ? 'Site Admin'
                        : 'Operator'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" /> Phone Number
                    </span>
                    <span className="text-xs font-medium text-[#171717] mt-1.5 block">
                      {editingUser.phone_number || 'Not provided'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-[#E3E4E6]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-500" /> Facility Site Assignment
                  </span>
                  <span className="text-xs font-medium text-[#171717] mt-1.5 block">
                    {editingUser.role === 'OEM_MANAGER'
                      ? 'All Facility Sites (Global OEM Access)'
                      : (() => {
                          const matched = sites.find((s) => s.id === editingUser.assigned_site_id);
                          return matched ? `${matched.site_name} (${matched.site_code})` : 'Unassigned';
                        })()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#E3E4E6] mt-2">
                  <span className="text-[11px] text-[#666666]">
                    Stored securely in PostgreSQL
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
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
                      <span>Edit User</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDITABLE FORM TAB */}
            {activeModalTab === 'edit' && (
              <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4">
                {/* Email: Immutable / Non-editable login identifier */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#171717] flex items-center justify-between">
                    <span>Email Address (Login Identifier)</span>
                    <span className="text-[10px] text-[#666666] font-medium flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-[#E3E4E6]">
                      <Lock className="w-3 h-3 text-[#666666]" /> Non-editable
                    </span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingUser.email}
                    className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-[#E3E4E6] rounded-lg text-slate-500 cursor-not-allowed select-none"
                  />
                </div>

                {/* Editable Name */}
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="First Name"
                    required
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    error={editErrors.first_name}
                  />
                  <InputField
                    label="Last Name"
                    required
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    error={editErrors.last_name}
                  />
                </div>

                {/* Editable Phone */}
                <InputField
                  label="Phone Number"
                  value={editFormData.phone_number}
                  onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                />

                {/* Editable Role (Scoped by caller) */}
                <SelectField
                  label="Role"
                  required
                  options={editRoleOptions}
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                />

                {/* Editable Assigned Site */}
                {editFormData.role !== 'OEM_MANAGER' && (
                  <SelectField
                    label="Assigned Facility Site"
                    required
                    options={siteOptions}
                    value={editFormData.assigned_site_id}
                    onChange={(e) => setEditFormData({ ...editFormData, assigned_site_id: e.target.value })}
                  />
                )}

                {/* Editable Status */}
                <label className="flex items-center gap-2 cursor-pointer select-none pt-2 border-t border-[#E3E4E6]">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-[#E32032] rounded border-[#E3E4E6] focus:ring-[#E32032]"
                  />
                  <span className="text-xs font-semibold text-[#171717]">Account is Active</span>
                </label>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3E4E6] mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
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
