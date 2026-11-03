import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { invitationsApi, sitesApi } from '../../services/api';
import type { Organization, User, UserRole, UserInvitation, Site } from '../../types';

interface InviteRow {
  email: string;
  role: UserRole;
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

  // Client pending invitations & physical sites
  const [pendingInvites, setPendingInvites] = useState<UserInvitation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // Existing owner status
  const activeOwner = existingUsers.find(
    (u) => (u.role === 'ORGANISATION_OWNER' || u.role === 'SITE_ADMIN') && u.is_active
  );
  const pendingOwnerInvite = pendingInvites.find(
    (i) => (i.role === 'ORGANISATION_OWNER' || i.role === 'SITE_ADMIN') && i.status === 'PENDING'
  );
  const hasExistingOwner = Boolean(activeOwner || pendingOwnerInvite);
  const existingOwnerEmail = activeOwner?.email || pendingOwnerInvite?.email;

  // Invitee rows state
  const [rows, setRows] = useState<InviteRow[]>([
    { email: '', role: isOem && !hasExistingOwner ? 'ORGANISATION_OWNER' : 'SITE_MANAGER' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load client invitations and sites when drawer opens
  useEffect(() => {
    if (isOpen && client?.id) {
      invitationsApi
        .list(client.id)
        .then((data) => {
          setPendingInvites(data.filter((i) => i.status === 'PENDING'));
        })
        .catch(() => setPendingInvites([]));

      sitesApi
        .getAll(client.id)
        .then(setSites)
        .catch(() => setSites([]));
    }
  }, [isOpen, client?.id]);

  useEffect(() => {
    if (isOpen) {
      const defaultRole: UserRole = isOem && !hasExistingOwner ? 'ORGANISATION_OWNER' : 'SITE_MANAGER';
      setRows([{ email: '', role: defaultRole }]);
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

  // Dynamic invitee rows
  const handleAddRow = () => {
    setRows((prev) => [...prev, { email: '', role: 'OPERATOR' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeRow = (index: number, field: keyof InviteRow, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Send invitations
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validRows = rows.map((r) => ({
      email: r.email.trim().toLowerCase(),
      role: r.role,
      site_id: (r.role === 'SITE_MANAGER' || r.role === 'OPERATOR') ? (r.site_id || undefined) : undefined,
    }));

    const emptyRow = validRows.find((r) => !r.email);
    if (emptyRow) {
      setError('Please provide an email address for each invitation.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const invalidEmail = validRows.find((r) => !emailRegex.test(r.email));
    if (invalidEmail) {
      setError(`"${invalidEmail.email}" is not a valid email address.`);
      return;
    }

    const emailsSet = new Set<string>();
    for (const r of validRows) {
      if (emailsSet.has(r.email)) {
        setError(`Email "${r.email}" is listed more than once.`);
        return;
      }
      emailsSet.add(r.email);
    }

    // Single Organisation Owner rules
    const ownerInvites = validRows.filter((r) => r.role === 'ORGANISATION_OWNER');
    if (ownerInvites.length > 0 && !isOem) {
      setError('Only OEM Managers can invite an Organisation Owner.');
      return;
    }

    if (ownerInvites.length > 1) {
      setError('Only one Organisation Owner can be invited for this client organization.');
      return;
    }

    if (ownerInvites.length > 0 && hasExistingOwner) {
      setError(
        `This client organization already has an assigned Organisation Owner (${existingOwnerEmail}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await invitationsApi.create(client.id, validRows);
      onSuccess(res.invited_count);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch invitations. Please try again.');
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
          {/* Drawer header */}
          <div className="px-6 sm:px-8 py-5 border-b border-[#E5E7EB] flex items-start justify-between bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-[#111827] tracking-tight">
                Invite users
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Add the email address and role of each person you want to invite to {client.company_name}.
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

          {/* Invitee rows form */}
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
                    <div key={idx} className="flex items-end gap-2.5">
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

                      <div className="w-36 shrink-0">
                        <label className="block text-xs font-medium text-[#374151] mb-1">
                          Role
                        </label>
                        <select
                          value={row.role}
                          onChange={(e) => handleChangeRow(idx, 'role', e.target.value as UserRole)}
                          disabled={isSubmitting}
                          className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2.5 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
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

                      {sites.length > 0 && (row.role === 'SITE_MANAGER' || row.role === 'OPERATOR') && (
                        <div className="w-36 shrink-0">
                          <label className="block text-xs font-medium text-[#374151] mb-1">
                            Site
                          </label>
                          <select
                            value={row.site_id || ''}
                            onChange={(e) => handleChangeRow(idx, 'site_id', e.target.value)}
                            disabled={isSubmitting}
                            className="w-full bg-white border border-[#D1D5DB] rounded-lg px-2.5 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                          >
                            <option value="">All sites / Unassigned</option>
                            {sites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.site_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

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
                  ))}
                </div>

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

              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                <p className="text-xs text-[#1E40AF] leading-relaxed">
                  Each person gets an email with a secure link to set their dashboard password. The invitation link expires in 7 days.
                </p>
              </div>
            </form>
          </div>

          {/* Footer actions */}
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

