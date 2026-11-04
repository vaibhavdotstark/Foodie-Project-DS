import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Phone, Shield, CheckCircle2, Loader2, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';

export const ProfilePage: React.FC = () => {
  const { user: currentUser, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: '',
  });

  const [errors, setErrors] = useState<{ first_name?: string; last_name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || '',
        role: currentUser.role === 'OEM_MANAGER' ? 'OEM Manager' : currentUser.role === 'SITE_ADMIN' ? 'Site Admin' : 'Operator',
      });
    }
  }, [currentUser]);

  const initials = `${formData.first_name.charAt(0) || 'O'}${formData.last_name.charAt(0) || 'M'}`.toUpperCase();

  const handleInputChange = (field: 'first_name' | 'last_name' | 'phone_number', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (successMessage) setSuccessMessage(null);
    if (errorMessage) setErrorMessage(null);
  };

  const handleReset = () => {
    if (currentUser) {
      setFormData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
        phone_number: currentUser.phone_number || '',
        role: currentUser.role === 'OEM_MANAGER' ? 'OEM Manager' : currentUser.role === 'SITE_ADMIN' ? 'Site Admin' : 'Operator',
      });
      setErrors({});
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { first_name?: string; last_name?: string } = {};
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Please enter your first name.';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Please enter your last name.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!currentUser?.id) {
      setErrorMessage('User session not found. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updatedUser = await usersApi.update(currentUser.id, {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone_number: formData.phone_number.trim() || undefined,
      });

      updateUser({
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        phone_number: updatedUser.phone_number,
      });

      setSuccessMessage('Profile updated successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">Profile</h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1">
          Manage your personal details and account settings.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Banner with Avatar & Identity */}
        <div className="px-6 py-6 border-b border-[#E5E7EB] bg-gradient-to-r from-[#FAFAFA] to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 text-[#E32032] flex items-center justify-center font-bold text-xl select-none shadow-2xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#171717]">
                  {formData.first_name} {formData.last_name}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[#666666] mt-0.5">{formData.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
              <Shield className="w-3.5 h-3.5 text-[#4B5563]" />
              {formData.role}
            </span>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-6 mt-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-6 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 text-xs font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Profile Edit Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                First Name <span className="text-[#E32032]">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className={`w-full h-10 px-3.5 rounded-lg border text-xs text-[#171717] bg-white transition-colors focus:outline-none focus:ring-1 ${
                    errors.first_name
                      ? 'border-[#E32032] focus:border-[#E32032] focus:ring-[#E32032]'
                      : 'border-[#D1D5DB] focus:border-[#171717] focus:ring-[#171717]'
                  }`}
                  placeholder="First name"
                />
              </div>
              {errors.first_name && (
                <p className="text-[11px] text-[#E32032] font-medium mt-1">{errors.first_name}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Last Name <span className="text-[#E32032]">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className={`w-full h-10 px-3.5 rounded-lg border text-xs text-[#171717] bg-white transition-colors focus:outline-none focus:ring-1 ${
                    errors.last_name
                      ? 'border-[#E32032] focus:border-[#E32032] focus:ring-[#E32032]'
                      : 'border-[#D1D5DB] focus:border-[#171717] focus:ring-[#171717]'
                  }`}
                  placeholder="Last name"
                />
              </div>
              {errors.last_name && (
                <p className="text-[11px] text-[#E32032] font-medium mt-1">{errors.last_name}</p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  tabIndex={-1}
                  className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-[#E5E7EB] text-xs text-[#4B5563] bg-[#F9FAFB] cursor-default select-all focus:outline-none"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-[#D1D5DB] text-xs text-[#171717] bg-white transition-colors focus:outline-none focus:border-[#171717] focus:ring-1 focus:ring-[#171717]"
                  placeholder="+61 400 000 000"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Assigned Role
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Shield className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={formData.role}
                  readOnly
                  tabIndex={-1}
                  className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-[#E5E7EB] text-xs text-[#4B5563] bg-[#F9FAFB] cursor-default focus:outline-none"
                />
              </div>
            </div>

            {/* Scope / Access */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Operational Scope
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={currentUser?.role === 'OEM_MANAGER' ? 'All Sites (OEM Fleet Scope)' : currentUser?.company_name || 'Standard Access'}
                  readOnly
                  tabIndex={-1}
                  className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-[#E5E7EB] text-xs text-[#4B5563] bg-[#F9FAFB] cursor-default focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-xs font-semibold text-[#374151] bg-white hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#E32032] hover:bg-[#C91A2A] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
