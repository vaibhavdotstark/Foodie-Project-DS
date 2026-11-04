import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { invitationsApi, usersApi } from '../../services/api';
import type { Organization, User, UserRole, UserInvitation } from '../../types';

interface InviteRow {
  email: string;
  role: UserRole;
  location?: string;
  site_manager_id?: string;
  site_id?: string;
}

interface InviteUsersDrawerProps {
  isOpen: boolean;
  client: Organization | null;
  existingUsers?: User[];
  onClose: () => void;
  onSuccess: (sentCount: number) => void;
}

export const InviteUsersDrawer: React.FC<InviteUsersDrawerProps> = ({
  isOpen,
  client,
  existingUsers = [],
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const isOem = currentUser?.role === 'OEM_MANAGER';

  const [pendingInvites, setPendingInvites] = useState<UserInvitation[]>([]);
  const [fetchedUsers, setFetchedUsers] = useState<User[]>([]);

  const allKnownUsers = useMemo(() => {
    const combined = [...existingUsers];
    for (const u of fetchedUsers) {
      if (!combined.some((item) => item.id === u.id)) {
        combined.push(u);
      }
    }
    return combined;
  }, [existingUsers, fetchedUsers]);

  const activeOwner = allKnownUsers.find(
    (u) => (u.role === 'ORGANISATION_OWNER' || u.role === 'SITE_ADMIN') && u.is_active
  );
  const pendingOwnerInvite = pendingInvites.find(
    (i) => (i.role === 'ORGANISATION_OWNER' || i.role === 'SITE_ADMIN') && i.status === 'PENDING'
  );
  const hasExistingOwner = Boolean(activeOwner || pendingOwnerInvite);
  const existingOwnerEmail = activeOwner?.email || pendingOwnerInvite?.email;

  // List of active and invited site managers with location
  const siteManagerOptions = useMemo(() => {
    const options: { id: string; label: string; location: string; site_id?: string }[] = [];
    const seenIds = new Set<string>();

    for (const u of allKnownUsers) {
      if (
        u.role === 'SITE_MANAGER' &&
        u.is_active &&
        (!client?.id || u.organization_id === client.id)
      ) {
        const loc = (u.location || u.site_name || '').trim();
        if (!loc) continue;
        seenIds.add(u.id);
        const fullName = `${u.first_name} ${u.last_name}`.trim() || u.email;
        options.push({
          id: u.id,
          label: `${fullName} (${loc})`,
          location: loc,
          site_id: u.site_id || undefined,
        });
      }
    }

    for (const inv of pendingInvites) {
      if (inv.role === 'SITE_MANAGER' && inv.status === 'PENDING' && !seenIds.has(inv.id)) {
        const loc = (inv.location || inv.site_name || '').trim();
        if (!loc) continue;
        options.push({
          id: inv.id,
          label: `${inv.email} (${loc})`,
          location: loc,
          site_id: inv.site_id || undefined,
        });
      }
    }

    return options;
  }, [allKnownUsers, pendingInvites, client?.id]);

  const [rows, setRows] = useState<InviteRow[]>([
    {
      email: '',
      role: isOem && !hasExistingOwner ? 'ORGANISATION_OWNER' : 'SITE_MANAGER',
      location: '',
      site_manager_id: '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && client?.id) {
      invitationsApi
        .list(client.id)
        .then((data) => {
          setPendingInvites(data.filter((i) => i.status === 'PENDING'));
        })
        .catch(() => setPendingInvites([]));

      usersApi
        .getAll()
        .then((data) => {
          setFetchedUsers(data.filter((u) => u.organization_id === client.id));
        })
        .catch(() => setFetchedUsers([]));
    }
  }, [isOpen, client?.id]);

  useEffect(() => {
    if (isOpen) {
      const defaultRole: UserRole =
        isOem && !hasExistingOwner ? 'ORGANISATION_OWNER' : 'SITE_MANAGER';
      setRows([
        {
          email: '',
          role: defaultRole,
          location: '',
          site_manager_id: '',
        },
      ]);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, hasExistingOwner, isOem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !client) return null;

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        email: '',
        role: 'SITE_MANAGER',
        location: '',
        site_manager_id: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeRow = (index: number, field: keyof InviteRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'role') {
        if (value === 'ORGANISATION_OWNER') {
          updated[index].location = '';
          updated[index].site_manager_id = '';
        } else if (value === 'SITE_MANAGER') {
          updated[index].site_manager_id = '';
        } else if (value === 'OPERATOR') {
          if (siteManagerOptions.length === 1) {
            const sm = siteManagerOptions[0];
            updated[index].site_manager_id = sm.id;
            updated[index].location = sm.location;
            updated[index].site_id = sm.site_id;
          }
        }
      }

      if (field === 'site_manager_id') {
        const selectedSm = siteManagerOptions.find((sm) => sm.id === value);
        if (selectedSm) {
          updated[index].location = selectedSm.location;
          updated[index].site_id = selectedSm.site_id;
        } else {
          updated[index].location = '';
          updated[index].site_id = undefined;
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Email validation & duplicate check
    const emailsSet = new Set<string>();
    const siteManagerLocationsSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cleanEmail = row.email.trim().toLowerCase();

      if (!cleanEmail) {
        setError('Please enter an email address for each person.');
        return;
      }

      if (!emailRegex.test(cleanEmail)) {
        setError(`"${row.email}" is not a valid email address.`);
        return;
      }

      if (emailsSet.has(cleanEmail)) {
        setError(`Email "${cleanEmail}" is listed more than once.`);
        return;
      }
      emailsSet.add(cleanEmail);

      // Site Manager location validations
      if (row.role === 'SITE_MANAGER') {
        const cleanLoc = (row.location || '').trim();
        if (!cleanLoc) {
          setError(`Please enter the site location for Site Manager (${cleanEmail}).`);
          return;
        }
        if (cleanLoc.length < 2 || cleanLoc.length > 100) {
          setError(`Site location for ${cleanEmail} must be between 2 and 100 characters.`);
          return;
        }

        const normalizedLoc = cleanLoc.toLowerCase();
        if (siteManagerLocationsSet.has(normalizedLoc)) {
          setError(`Location "${cleanLoc}" is used more than once. Each Site Manager must have a unique location.`);
          return;
        }
        siteManagerLocationsSet.add(normalizedLoc);

        // Check against active and pending site manager locations
        const alreadyExists = siteManagerOptions.some(
          (sm) => sm.location.trim().toLowerCase() === normalizedLoc
        );
        if (alreadyExists) {
          setError(`A Site Manager with location "${cleanLoc}" already exists or is pending for this organisation. Location must be unique.`);
          return;
        }
      }

      // Operator assignment validation
      if (row.role === 'OPERATOR') {
        if (!row.site_manager_id) {
          setError(`Please select an assigned Site Manager (Location) for Operator (${cleanEmail}).`);
          return;
        }
      }
    }

    // Organisation Owner rules
    const ownerInvites = rows.filter((r) => r.role === 'ORGANISATION_OWNER');
    if (ownerInvites.length > 0 && !isOem) {
      setError('Only OEM Managers can invite an Organisation Owner.');
      return;
    }

    if (ownerInvites.length > 1) {
      setError('Only one Organisation Owner can be invited per organisation.');
      return;
    }

    if (ownerInvites.length > 0 && hasExistingOwner) {
      setError(
        `This organisation already has an assigned Organisation Owner (${existingOwnerEmail}).`
      );
      return;
    }

    const payload = rows.map((r) => ({
      email: r.email.trim().toLowerCase(),
      role: r.role,
      location: r.role === 'SITE_MANAGER' || r.role === 'OPERATOR' ? (r.location?.trim() || undefined) : undefined,
      site_manager_id: r.role === 'OPERATOR' ? (r.site_manager_id || undefined) : undefined,
      site_id: r.site_id || undefined,
    }));

    setIsSubmitting(true);
    try {
      const res = await invitationsApi.create(client.id, payload);
      onSuccess(res.invited_count);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitations. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-200 ease-in-out animate-in slide-in-from-right">
          {/* Header matching wireframe */}
          <div className="px-6 sm:px-8 py-5 border-b border-[#E5E7EB] flex items-start justify-between bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-[#111827] tracking-tight">
                Invite users
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Add the email address and role of each person you want to invite.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6">
            <form id="invite-users-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  People to invite
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5 mb-4">
                  Choose a role for each person. Roles can be changed later.
                </p>

                <div className="space-y-3.5">
                  {rows.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white space-y-3 transition-colors hover:border-[#D1D5DB]"
                    >
                      {/* Main input row: Email address | Role | Trash */}
                      <div className="flex items-end gap-2.5">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-[#374151] mb-1">
                            Email address
                          </label>
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => handleChangeRow(idx, 'email', e.target.value)}
                            placeholder="name@example.com"
                            required
                            disabled={isSubmitting}
                            className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                          />
                        </div>

                        <div className="w-44 shrink-0">
                          <label className="block text-xs font-medium text-[#374151] mb-1">
                            Role
                          </label>
                          <select
                            value={row.role}
                            onChange={(e) => handleChangeRow(idx, 'role', e.target.value as UserRole)}
                            disabled={isSubmitting}
                            className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                          >
                            {isOem && (
                              <option
                                value="ORGANISATION_OWNER"
                                disabled={hasExistingOwner && row.role !== 'ORGANISATION_OWNER'}
                              >
                                Organisation Owner{hasExistingOwner ? ' (Assigned)' : ''}
                              </option>
                            )}
                            <option value="SITE_MANAGER">Site Manager</option>
                            <option value="OPERATOR">Operator</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={rows.length === 1 || isSubmitting}
                          className={`p-2 rounded-lg border border-[#E5E7EB] transition-colors cursor-pointer mb-[1px] ${
                            rows.length === 1
                              ? 'opacity-30 cursor-not-allowed text-[#9CA3AF]'
                              : 'text-[#6B7280] hover:text-[#E32032] hover:border-red-200 hover:bg-red-50'
                          }`}
                          title="Remove person"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Fields when Site Manager is selected */}
                      {row.role === 'SITE_MANAGER' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#F3F4F6]">
                          <div>
                            <label className="block text-xs font-medium text-[#374151] mb-1">
                              Organisation
                            </label>
                            <input
                              type="text"
                              value={client.company_name}
                              disabled
                              readOnly
                              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[#6B7280] cursor-not-allowed select-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#374151] mb-1">
                              Site location <span className="text-[#E32032]">*</span>
                            </label>
                            <input
                              type="text"
                              value={row.location || ''}
                              onChange={(e) => handleChangeRow(idx, 'location', e.target.value)}
                              placeholder="e.g. Melbourne Plant, 34-D Adelaide"
                              required
                              disabled={isSubmitting}
                              className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-1.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {/* Fields when Operator is selected */}
                      {row.role === 'OPERATOR' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#F3F4F6]">
                          <div>
                            <label className="block text-xs font-medium text-[#374151] mb-1">
                              Organisation
                            </label>
                            <input
                              type="text"
                              value={client.company_name}
                              disabled
                              readOnly
                              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[#6B7280] cursor-not-allowed select-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#374151] mb-1">
                              Site Manager <span className="text-[#E32032]">*</span>
                            </label>
                            <select
                              value={row.site_manager_id || ''}
                              onChange={(e) => handleChangeRow(idx, 'site_manager_id', e.target.value)}
                              required
                              disabled={isSubmitting || siteManagerOptions.length === 0}
                              className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3 py-1.5 text-xs font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]"
                            >
                              <option value="">
                                {siteManagerOptions.length > 0
                                  ? 'Select Site Manager (Location)...'
                                  : 'No Site Managers available'}
                              </option>
                              {siteManagerOptions.map((sm) => (
                                <option key={sm.id} value={sm.id}>
                                  {sm.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Fields when Organisation Owner is selected */}
                      {row.role === 'ORGANISATION_OWNER' && (
                        <div className="pt-2 border-t border-[#F3F4F6]">
                          <label className="block text-xs font-medium text-[#374151] mb-1">
                            Organisation
                          </label>
                          <input
                            type="text"
                            value={client.company_name}
                            disabled
                            readOnly
                            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[#6B7280] cursor-not-allowed select-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add another email button */}
                <button
                  type="button"
                  onClick={handleAddRow}
                  disabled={isSubmitting}
                  className="mt-4 w-full py-2.5 border border-dashed border-[#D1D5DB] hover:border-[#111827] rounded-xl text-xs font-semibold text-[#374151] hover:text-[#111827] hover:bg-[#F9FAFB] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another email</span>
                </button>
              </div>

              {/* Information Callout */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <p className="text-xs text-[#1E40AF] leading-relaxed">
                  Each person gets an email with a link to set their password. The link expires in 7 days.
                </p>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="px-6 sm:px-8 py-4 border-t border-[#E5E7EB] bg-white flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="invite-users-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending invites...</span>
                </>
              ) : (
                <span>Send invites</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
