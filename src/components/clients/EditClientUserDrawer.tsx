import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, UserCheck, UserPlus, Shield, Building2, Calendar, User as UserIcon, MapPin } from 'lucide-react';
import { usersApi } from '../../services/api';
import type { Organization, User } from '../../types';

export interface EditClientUserDrawerProps {
  isOpen: boolean;
  client: Organization;
  user: User | null;
  existingUsers?: User[];
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const EditClientUserDrawer: React.FC<EditClientUserDrawerProps> = ({
  isOpen,
  client,
  user,
  existingUsers = [],
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = user?.role || 'OPERATOR';
  const roleLabel =
    role === 'SITE_MANAGER'
      ? 'Site Manager'
      : role === 'OPERATOR'
      ? 'Operator'
      : role === 'ORGANISATION_OWNER' || role === 'SITE_ADMIN'
      ? 'Organisation Owner'
      : 'User';

  const joinedFormatted = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // Site managers for dropdown if operator
  const siteManagers = existingUsers.filter(
    (u) => (u.role === 'SITE_MANAGER') && u.organization_id === client.id && u.is_active !== false
  );

  // Prefill form cleanly without duplicating first/last name
  useEffect(() => {
    if (isOpen && user) {
      // Avoid name duplication bug if previous bug saved first_name in last_name
      const fName = (user.first_name || '').trim();
      const lName = (user.last_name || '').trim();
      const cleanFull = fName && lName && fName.toLowerCase() === lName.toLowerCase()
        ? fName
        : [fName, lName].filter(Boolean).join(' ');

      setFullName(cleanFull);
      setEmail(user.email || '');
      setPhoneNumber(user.phone_number || '');
      setLocation(user.location || '');
      setError(null);
      setIsSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, user]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !user) return null;

  // Strict Phone input handler: blocks alphabetic characters and caps at 25 characters
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9+\-\s()]*$/.test(val) && val.length <= 25) {
      setPhoneNumber(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Full name validation: max 20 words, at least 2 chars
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter a valid full name (at least 2 characters).');
      return;
    }
    const words = trimmedName.split(/\s+/).filter(Boolean);
    if (words.length > 20) {
      setError('Full name cannot exceed 20 words.');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Full name cannot exceed 100 characters.');
      return;
    }

    // 2. Email validation
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    // 3. Phone validation
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      setError('Please enter a phone number.');
      return;
    }
    if (/[a-zA-Z]/.test(trimmedPhone)) {
      setError('Phone number cannot contain alphabets.');
      return;
    }
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 25) {
      setError('Phone number must contain between 8 and 25 digits.');
      return;
    }

    // 4. Location validation
    const trimmedLocation = location.trim();
    if (!trimmedLocation) {
      setError('Please enter or select a location.');
      return;
    }

    if (role === 'SITE_MANAGER') {
      const duplicateSiteManager = existingUsers.find(
        (u) =>
          u.id !== user.id &&
          u.role === 'SITE_MANAGER' &&
          u.organization_id === client.id &&
          u.is_active !== false &&
          (u.location || '').trim().toLowerCase() === trimmedLocation.toLowerCase()
      );
      if (duplicateSiteManager) {
        setError(`A site manager with location "${trimmedLocation}" already exists for this organisation. Location must be unique.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    // Split full name cleanly into first and last name (NEVER copy first into last)
    const firstName = words[0] || '';
    const lastName = words.length > 1 ? words.slice(1).join(' ') : '';

    try {
      const updatedUser = await usersApi.update(user.id, {
        first_name: firstName,
        last_name: lastName,
        email: trimmedEmail,
        phone_number: trimmedPhone,
        location: trimmedLocation,
        role: user.role,
      });

      onSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setError(err?.message || `Failed to update ${roleLabel.toLowerCase()}. Please try again.`);
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
        className="fixed inset-0 bg-black/45 backdrop-blur-2xs transition-opacity animate-in fade-in duration-300"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-[#E5E7EB] animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-center text-[#E32032] shrink-0">
                {role === 'SITE_MANAGER' ? (
                  <UserCheck className="w-5 h-5" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                  Edit {roleLabel.toLowerCase()}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {client.company_name} · {client.client_code}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 sm:mx-8 mt-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2.5 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form
            id="edit-client-user-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 text-xs"
          >
            {/* User Details */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider text-[#9CA3AF]">
                User Information
              </h4>

              {/* Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#374151]">
                    Full name <span className="text-[#E32032]">*</span>
                  </label>
                  <span className="text-[10px] text-[#9CA3AF]">Max 20 words</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    disabled={isSubmitting}
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Email address <span className="text-[#E32032]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={isSubmitting}
                  className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                />
              </div>

              {/* Phone Number */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#374151]">
                    Phone number <span className="text-[#E32032]">*</span>
                  </label>
                  <span className="text-[10px] text-[#9CA3AF]">Numbers only, max 25 digits</span>
                </div>
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="+91 98765 43210"
                  maxLength={25}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                />
              </div>

              {/* Location Field */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Location / Facility <span className="text-[#E32032]">*</span>
                </label>
                {role === 'OPERATOR' && siteManagers.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                    >
                      <option value="">-- Choose from Site Manager Locations --</option>
                      {siteManagers.map((sm) => {
                        const smName = `${sm.first_name || ''} ${sm.last_name || ''}`.trim() || sm.email;
                        const smLoc = sm.location || 'Main Site';
                        return (
                          <option key={sm.id} value={smLoc}>
                            {smName} ({smLoc})
                          </option>
                        );
                      })}
                    </select>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Or customize location name"
                        disabled={isSubmitting}
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Sydney Facility - Building A"
                      disabled={isSubmitting}
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Prefilled Assignment Details */}
            <div className="space-y-3.5 pt-2">
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider text-[#9CA3AF]">
                Role & Assignment Details
              </h4>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-3.5">
                {/* Role */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Shield className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Role</span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]">
                    {roleLabel}
                  </span>
                </div>

                {/* Organisation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Building2 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Organisation</span>
                  </div>
                  <span className="text-xs font-semibold text-[#111827] text-right">
                    {client.company_name} ({client.organisation_code || client.client_code})
                  </span>
                </div>

                {/* Joined / Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Joined</span>
                  </div>
                  <span className="text-xs font-medium text-[#111827]">
                    {joinedFormatted}
                  </span>
                </div>
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="px-6 sm:px-8 py-4 border-t border-[#E5E7EB] bg-white flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-client-user-form"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
