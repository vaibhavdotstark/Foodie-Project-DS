import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Save,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';
import { Toast } from '../components/common/Toast';
import type { UserRole } from '../types';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhoneNumber(user.phone_number || '');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [user]);

  const handleReset = () => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhoneNumber(user.phone_number || '');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 5) {
        setError('New password must be at least 5 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim() || undefined,
      };

      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const updatedUser = await usersApi.update(user.id, payload);
      updateUser(updatedUser);
      setNewPassword('');
      setConfirmPassword('');
      setToast({
        message: 'Your profile has been updated successfully.',
        type: 'success',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInitials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'OEM';

  const roleTitleMap: Record<UserRole, string> = {
    OEM_MANAGER: 'OEM Asset Manager',
    SITE_ADMIN: 'Site Admin',
    OPERATOR: 'Operator',
  };

  const displayRole = user ? roleTitleMap[user.role] || user.role : 'OEM Asset Manager';
  const displayCompany =
    user?.role === 'OEM_MANAGER'
      ? 'PowerTech Energy'
      : (user?.company_name || 'Client Workspace');

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

  const formatDateTime = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto select-none pb-10">
      {/* 1. Header / Breadcrumbs */}
      <div className="pt-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#6B7280] mb-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#171717] cursor-pointer transition-colors"
          >
            Home
          </button>
          <span className="text-[#9CA3AF]">/</span>
          <span className="font-bold text-[#171717]">OEM Manager Profile</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
              Profile & Account Settings
            </h1>
            <p className="text-xs text-[#666666] mt-0.5">
              View, edit, and update your personal details, contact number, and security credentials.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Hero Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#FFEBEB] text-[#991B1B] font-extrabold text-2xl sm:text-3xl flex items-center justify-center border border-red-200 shadow-2xs shrink-0">
            {userInitials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#171717]">
                {user ? `${user.first_name} ${user.last_name}` : 'OEM Manager'}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAFBF1] text-[#0A7135] border border-[#B7F4CE]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C951]" />
                <span>Active Account</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] mt-1.5 font-medium">
              <span className="flex items-center gap-1 text-[#171717] font-semibold">
                <Shield className="w-3.5 h-3.5 text-[#E32032]" />
                {displayRole}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#6B7280]" />
                {displayCompany}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#6B7280]" />
                {user?.email || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Form Area */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-[#E32032] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal Information (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#F0F1F3]">
                <UserIcon className="w-4 h-4 text-[#E32032]" />
                <h3 className="text-sm font-bold text-[#171717]">
                  Personal Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    First name <span className="text-[#E32032]">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Last name <span className="text-[#E32032]">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-2 text-xs text-[#6B7280] cursor-not-allowed"
                    />
                    <Lock className="w-3.5 h-3.5 text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                    Login email is managed by system administrator.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Phone number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+61 400 123 456"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                    <Phone className="w-3.5 h-3.5 text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Assigned role
                  </label>
                  <input
                    type="text"
                    value={displayRole}
                    disabled
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-2 text-xs font-semibold text-[#171717] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Organization / Workspace
                  </label>
                  <input
                    type="text"
                    value={displayCompany}
                    disabled
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-2 text-xs font-semibold text-[#171717] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Security & Password Card */}
            <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#F0F1F3]">
                <KeyRound className="w-4 h-4 text-[#E32032]" />
                <h3 className="text-sm font-bold text-[#171717]">
                  Password & Security
                </h3>
              </div>

              <p className="text-xs text-[#6B7280] mb-4">
                Leave the password fields empty if you do not wish to update your current login password.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-3.5 pr-10 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-3.5 pr-10 py-2 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Account Meta & Actions (1 col) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#F0F1F3]">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                  Account Activity
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="block text-[11px] text-[#6B7280]">Account Identifier</span>
                  <span className="font-mono font-bold text-[#171717] truncate block text-[11px]">
                    {user?.id || '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] text-[#6B7280]">Member Since</span>
                  <span className="font-semibold text-[#171717]">
                    {formatDate(user?.created_at)}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] text-[#6B7280]">Last Login</span>
                  <span className="font-semibold text-[#171717]">
                    {formatDateTime(user?.last_login_at)}
                  </span>
                </div>

                <div>
                  <span className="block text-[11px] text-[#6B7280]">Security Status</span>
                  <div className="flex items-center gap-1.5 mt-1 text-[#0A7135] font-semibold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Password Protected & Verified</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-2xl border border-[#E3E4E6] p-5 shadow-xs flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save profile changes</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Reset to saved</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Toast Feedback */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

