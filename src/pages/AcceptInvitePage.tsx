import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Building2,
  Shield,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { FoodieLogo } from '../components/common/FoodieLogo';
import { invitationsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { VerifyInvitationData } from '../types';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [inviteData, setInviteData] = useState<VerifyInvitationData | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // User registration state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setVerifyError('No invitation token was provided in the link.');
      setIsLoading(false);
      return;
    }

    invitationsApi
      .verify(token)
      .then((data) => {
        setInviteData(data);
      })
      .catch((err) => {
        setVerifyError(
          err?.message ||
            'This invitation link is invalid, expired, or has already been used. Please ask your administrator for a new invite.'
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  // Set password and complete registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!firstName.trim()) {
      setSubmitError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setSubmitError('Last name is required.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await invitationsApi.accept({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim() || undefined,
        password,
      });

      loginWithToken(res.user, res.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleDisplayMap: Record<string, string> = {
    ORGANISATION_OWNER: 'Organisation Owner',
    SITE_MANAGER: 'Site Manager',
    OPERATOR: 'Operator',
    SITE_ADMIN: 'Organisation Owner',
    OEM_MANAGER: 'OEM Asset Manager',
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-md">
        {/* Platform header */}
        <div className="text-center mb-6">
          <div className="inline-flex justify-center mb-3">
            <FoodieLogo size="lg" showEndorsement={true} />
          </div>
          <h1 className="text-xl font-bold text-[#171717] tracking-tight">
            Account Setup & Password
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Activate your Foodie platform access and set your dashboard credentials.
          </p>
        </div>

        {/* Account setup card */}
        <div className="bg-white rounded-2xl border border-[#E3E4E6] p-6 sm:p-7 shadow-xs">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-[#E32032] animate-spin mb-3" />
              <p className="text-xs font-semibold text-[#171717]">
                Verifying your invitation...
              </p>
            </div>
          )}

          {!isLoading && verifyError && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-[#E32032] flex items-center justify-center mx-auto border border-red-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#171717]">
                  Invitation Expired or Invalid
                </h3>
                <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                  {verifyError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {!isLoading && inviteData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organization and assigned role */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7280] flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    Organization
                  </span>
                  <span className="font-bold text-[#111827]">
                    {inviteData.company_name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7280] flex items-center gap-1.5 font-medium">
                    <Shield className="w-3.5 h-3.5 text-[#E32032]" />
                    Role
                  </span>
                  <span className="font-bold text-[#E32032]">
                    {roleDisplayMap[inviteData.role] || inviteData.role}
                  </span>
                </div>
                {inviteData.location && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#E32032]" />
                      Site / Location
                    </span>
                    <span className="font-semibold text-[#111827]">
                      {inviteData.location}
                    </span>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#E32032] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{submitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={inviteData.email}
                    disabled
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-3.5 py-2 text-xs text-[#6B7280] cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    First name <span className="text-[#E32032]">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    disabled={isSubmitting}
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    Last name <span className="text-[#E32032]">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    disabled={isSubmitting}
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#374151]">
                    Phone number (optional)
                  </label>
                  <span className="text-[10px] text-[#888888]">
                    {phoneNumber.length}/25
                  </span>
                </div>
                <input
                  type="tel"
                  maxLength={25}
                  value={phoneNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9+\s()-]/g, '').slice(0, 25);
                    setPhoneNumber(clean);
                  }}
                  placeholder="+61 400 123 456"
                  disabled={isSubmitting}
                  className="w-full bg-white border border-[#D1D5DB] rounded-lg px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Create password <span className="text-[#E32032]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    disabled={isSubmitting}
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-3.5 pr-10 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
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
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Confirm password <span className="text-[#E32032]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    disabled={isSubmitting}
                    className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-3.5 pr-10 py-2 text-xs text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold bg-[#E32032] hover:bg-[#C1121F] text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating your account...</span>
                  </>
                ) : (
                  <>
                    <span>Set password & access dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-[11px] text-[#9CA3AF] text-center mt-6">
          © 2026 PowerTech Energy Pty Ltd · Foodie Composter Platform
        </p>
      </div>
    </div>
  );
};
