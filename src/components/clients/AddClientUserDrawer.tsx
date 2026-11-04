import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, UserCheck, UserPlus, Shield, Building2, Calendar, User as UserIcon, MapPin } from 'lucide-react';
import { usersApi } from '../../services/api';
import type { Organization, User } from '../../types';

export interface AddClientUserDrawerProps {
  isOpen: boolean;
  client: Organization;
  role: 'SITE_MANAGER' | 'OPERATOR';
  existingUsers?: User[];
  onClose: () => void;
  onSuccess: (newUser: User) => void;
}

export const AddClientUserDrawer: React.FC<AddClientUserDrawerProps> = ({
  isOpen,
  client,
  role,
  existingUsers = [],
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSiteManagerId, setSelectedSiteManagerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = role === 'SITE_MANAGER' ? 'Site Manager' : 'Operator';

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Filter site managers for this organisation to populate the operator dropdown
  const siteManagers = existingUsers.filter(
    (u) => (u.role === 'SITE_MANAGER') && u.organization_id === client.id && u.is_active !== false
  );

  // Reset form when drawer opens or role changes
  useEffect(() => {
    if (isOpen) {
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setLocation('');
      setSelectedSiteManagerId('');
      setError(null);
      setIsSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, role]);

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

  if (!isOpen) return null;

  // Strict Phone input handler: blocks any alphabetic characters and caps at 25 characters
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9+\-\s()]*$/.test(val) && val.length <= 25) {
      setPhoneNumber(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Full name validation: required, at least 2 chars, max 20 words
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
      setError('Please enter a valid business email address.');
      return;
    }

    // 3. Phone validation: numbers only, max 25 chars, 8-25 digits
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
    let resolvedLocation = location.trim();
    if (role === 'OPERATOR') {
      if (siteManagers.length > 0) {
        if (!selectedSiteManagerId) {
          setError('Please select a Site Manager and location from the dropdown.');
          return;
        }
        const sm = siteManagers.find((s) => s.id === selectedSiteManagerId);
        resolvedLocation = sm?.location || location.trim() || 'Assigned Site';
      } else {
        if (!resolvedLocation) {
          setError('Please enter the assigned location for this operator.');
          return;
        }
      }
    } else {
      // Site Manager requires location
      if (!resolvedLocation) {
        setError('Please enter a location for the site manager.');
        return;
      }
      // Prevent duplicate location for Site Manager within the same organisation
      const duplicateSiteManager = existingUsers.find(
        (u) =>
          u.role === 'SITE_MANAGER' &&
          u.organization_id === client.id &&
          u.is_active !== false &&
          (u.location || '').trim().toLowerCase() === resolvedLocation.toLowerCase()
      );
      if (duplicateSiteManager) {
        setError(`A site manager with location "${resolvedLocation}" already exists for this organisation. Location must be unique.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    // Clean first_name & last_name without duplicating
    const firstName = words[0] || '';
    const lastName = words.length > 1 ? words.slice(1).join(' ') : '';

    try {
      const createdUser = await usersApi.create({
        organization_id: client.id,
        email: trimmedEmail,
        phone_number: trimmedPhone,
        first_name: firstName,
        last_name: lastName,
        role: role,
        location: resolvedLocation,
        password: '12345',
      });

      onSuccess(createdUser);
      onClose();
    } catch (err: any) {
      console.error('Failed to create user:', err);
      const msg = typeof err?.message === 'string' && !err.message.includes('[object')
        ? err.message
        : `Failed to add ${roleLabel.toLowerCase()}. Please try again.`;
      setError(msg);
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
                  Add {roleLabel.toLowerCase()}
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
            id="add-client-user-form"
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
              {role === 'SITE_MANAGER' ? (
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Location / Facility name <span className="text-[#E32032]">*</span>
                  </label>
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
                </div>
              ) : (
                /* Operator Role: Select Site Manager & Location Dropdown */
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Assigned Site Manager & Location <span className="text-[#E32032]">*</span>
                  </label>
                  {siteManagers.length > 0 ? (
                    <div className="relative">
                      <select
                        required
                        value={selectedSiteManagerId}
                        onChange={(e) => {
                          const smId = e.target.value;
                          setSelectedSiteManagerId(smId);
                          const sm = siteManagers.find((s) => s.id === smId);
                          if (sm) {
                            setLocation(sm.location || 'Assigned Site');
                          } else {
                            setLocation('');
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all cursor-pointer"
                      >
                        <option value="">-- Select Site Manager (Location) --</option>
                        {siteManagers.map((sm) => {
                          const smName = `${sm.first_name || ''} ${sm.last_name || ''}`.trim() || sm.email;
                          const smLoc = sm.location || 'Main Site';
                          return (
                            <option key={sm.id} value={sm.id}>
                              {smName} ({smLoc})
                            </option>
                          );
                        })}
                      </select>
                      {location && (
                        <p className="mt-1.5 text-[11px] text-[#059669] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>Assigned Location: <strong>{location}</strong></span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Sydney Facility - Line 1"
                          disabled={isSubmitting}
                          className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[#D97706]">
                        No Site Manager added yet. Once a Site Manager is added, their name and (location) will show in this dropdown.
                      </p>
                    </div>
                  )}
                </div>
              )}
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

                {/* Invited By */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <UserCheck className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Invited by</span>
                  </div>
                  <span className="text-xs font-medium text-[#111827]">
                    OEM Manager
                  </span>
                </div>

                {/* Joined / Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Joined</span>
                  </div>
                  <span className="text-xs font-medium text-[#111827]">
                    {todayFormatted}
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
              form="add-client-user-form"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding {roleLabel.toLowerCase()}...</span>
                </>
              ) : (
                <span>Add {roleLabel.toLowerCase()}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
