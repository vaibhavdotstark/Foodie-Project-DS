import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  CheckCircle2,
  LogOut,
  Clock,
  ArrowLeft,
  Loader2,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { AuthHero } from '../components/auth/AuthHero';
import { BRAND_ASSETS, BRAND_COPY } from '../config/brandConfig';

type AuthView =
  | 'SIGN_IN'
  | 'FORGOT_PASSWORD'
  | 'CHECK_EMAIL'
  | 'SET_NEW_PASSWORD'
  | 'PASSWORD_UPDATED'
  | 'SIGNED_OUT'
  | 'SESSION_EXPIRED';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  // State management
  const [view, setView] = useState<AuthView>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset flow state
  const [resetToken, setResetToken] = useState<string>('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check URL params for special initial views (e.g. ?view=signed_out, ?view=expired, or reset link)
  useEffect(() => {
    const urlView = searchParams.get('view');
    const token = searchParams.get('token');
    const queryEmail = searchParams.get('email');
    const isSessionExpired = sessionStorage.getItem('foodie_session_expired') === 'true';
    const storedExpiredEmail = sessionStorage.getItem('foodie_expired_email');

    if (queryEmail) {
      setEmail(queryEmail);
    } else if (storedExpiredEmail) {
      setEmail(storedExpiredEmail);
    }

    if (token) {
      setResetToken(token);
      setView('SET_NEW_PASSWORD');
      setIsVerifyingToken(true);
      setIsTokenValid(null);
      setErrorMessage(null);
      // Verify token validity against backend database
      authApi.verifyResetToken(token)
        .then((res) => {
          setIsTokenValid(true);
          if (res.email) {
            setEmail(res.email);
          }
        })
        .catch((err) => {
          setIsTokenValid(false);
          setErrorMessage(err.message || 'This reset link is invalid or has expired.');
        })
        .finally(() => {
          setIsVerifyingToken(false);
        });
    } else if (urlView === 'signed_out') {
      setView('SIGNED_OUT');
    } else if (urlView === 'expired' || isSessionExpired) {
      sessionStorage.removeItem('foodie_session_expired');
      sessionStorage.removeItem('foodie_expired_email');
      setView('SESSION_EXPIRED');
    } else if (urlView === 'forgot') {
      setView('FORGOT_PASSWORD');
    }
  }, [searchParams]);

  // Handle standard login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      // Pick up right where the user left off if returning from an expired session
      const redirectPath = sessionStorage.getItem('foodie_redirect_after_login') || '/';
      sessionStorage.removeItem('foodie_redirect_after_login');
      navigate(redirectPath);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Email or password is incorrect. Check your details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password submission
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setView('CHECK_EMAIL');
    } catch (err: any) {
      setErrorMessage(err.message || 'No account found with this email address.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Update Password submission
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasMinLen = newPassword.length >= 12;
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

    if (!hasMinLen || !hasNumber || !hasSymbol || !passwordsMatch) {
      setErrorMessage('Please satisfy all password security requirements.');
      return;
    }

    if (!resetToken) {
      setErrorMessage('Reset token is missing or expired. Please request a new link.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await authApi.resetPassword(resetToken, newPassword);
      setView('PASSWORD_UPDATED');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Live password requirements calculation
  const hasMinLength = newPassword.length >= 12;
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="h-screen max-h-screen w-full flex bg-white font-sans antialiased overflow-hidden">
      {/* 1. Left 50% Width Hero (Responsive, never overflows, 100% viewport fit) */}
      <AuthHero />

      {/* 2. Right 50% Width Interactive Auth Container */}
      <div className="w-full lg:w-1/2 h-full max-h-screen flex flex-col justify-between px-6 sm:px-10 lg:px-12 xl:px-16 py-6 sm:py-8 bg-white overflow-y-auto">
        {/* Top spacer */}
        <div className="hidden sm:block h-1" />

        {/* Center Content Box - vertically auto-centered */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-2">
          {/* ======================================================== */}
          {/* VIEW 1: SIGN IN */}
          {/* ======================================================== */}
          {view === 'SIGN_IN' && (
            <div>
              {/* Header */}
              <div className="mb-5">
                <h2 className="text-xl sm:text-[24px] font-bold text-[#111827] tracking-tight leading-snug">
                  {BRAND_COPY.authWelcomeTitle}
                </h2>
                <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1 leading-normal">
                  {BRAND_COPY.authWelcomeSubtitle}
                </p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-[#E32032] flex-shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-3.5">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="priya.shah@greenvalley.example"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] transition-all bg-white"
                  />
                </div>

                {/* Password Field with Eye Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••••••••••••"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-xs sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E32032] transition-all bg-white ${
                        errorMessage
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-[#D1D5DB] focus:border-[#E32032]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errorMessage && (
                    <p className="text-[11px] font-medium text-[#E32032] mt-1">
                      Incorrect password
                    </p>
                  )}
                </div>

                {/* Keep Signed In & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      className="w-4 h-4 rounded text-[#E32032] border-[#D1D5DB] focus:ring-[#E32032] accent-[#E32032] cursor-pointer"
                    />
                    <span className="text-[#374151] font-medium">Keep me signed in</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setView('FORGOT_PASSWORD');
                    }}
                    className="text-[#E32032] hover:text-[#C71828] font-semibold underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Primary Action Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>

                {/* Accounts setup notice directly below Sign In button */}
                <p className="text-[11px] sm:text-xs text-[#6B7280] text-center mt-3.5 leading-relaxed font-normal">
                  Accounts are set up by your Site Admin or PowerTech Energy.
                </p>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: FORGOT PASSWORD */}
          {/* ======================================================== */}
          {view === 'FORGOT_PASSWORD' && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl sm:text-[22px] font-bold text-[#111827] tracking-tight leading-snug">
                  Reset your password
                </h2>
                <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1 leading-normal">
                  Enter the email linked to your account and we'll send you a reset link.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSendResetLink} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="priya.shah@greenvalley.example"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] transition-all bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <span>Send reset link</span>
                  )}
                </button>

                <div className="text-center pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setView('SIGN_IN');
                    }}
                    className="text-xs font-semibold text-[#374151] hover:text-[#111827] flex items-center justify-center gap-1.5 mx-auto transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: CHECK EMAIL */}
          {/* ======================================================== */}
          {view === 'CHECK_EMAIL' && (
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-red-50 text-[#E32032] flex items-center justify-center mx-auto mb-3.5 border border-red-100">
                <Mail className="w-5 h-5" />
              </div>

              <h2 className="text-xl sm:text-[22px] font-bold text-[#111827] tracking-tight">
                Check your email
              </h2>
              <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1.5 leading-relaxed max-w-sm mx-auto">
                We sent a reset link to <span className="font-semibold text-[#111827]">{email}</span>. The link expires in 30 minutes.
              </p>

              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setView('SIGN_IN')}
                  className="w-full bg-white hover:bg-neutral-50 border border-[#D1D5DB] text-[#374151] py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>

              <p className="text-[11px] sm:text-xs text-[#6B7280] mt-5 leading-relaxed">
                Didn't get the email? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={handleSendResetLink}
                  className="text-[#E32032] underline hover:text-[#C71828] font-medium cursor-pointer"
                >
                  resend the link
                </button>
                .
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: SET NEW PASSWORD */}
          {/* ======================================================== */}
          {view === 'SET_NEW_PASSWORD' && (
            <div>
              {isVerifyingToken ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-[#E32032] mx-auto mb-2.5" />
                  <p className="text-xs sm:text-sm font-medium text-[#4B5563]">
                    Verifying security token...
                  </p>
                </div>
              ) : isTokenValid === false ? (
                <div className="text-center py-3">
                  <div className="w-11 h-11 rounded-full bg-red-50 text-[#E32032] flex items-center justify-center mx-auto mb-3 border border-red-100">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#111827] tracking-tight">
                    Reset link invalid or expired
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1.5 mb-5 leading-relaxed max-w-sm mx-auto">
                    {errorMessage || 'This password reset link is invalid or has expired (valid for 30 minutes). Please request a new link.'}
                  </p>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setView('FORGOT_PASSWORD');
                      }}
                      className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer"
                    >
                      Request a new reset link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setView('SIGN_IN');
                      }}
                      className="w-full bg-white hover:bg-neutral-50 border border-[#D1D5DB] text-[#374151] py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-5">
                    <h2 className="text-xl sm:text-[22px] font-bold text-[#111827] tracking-tight leading-snug">
                      Set a new password
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1 leading-normal">
                      Choose a password you haven’t used for Foodie Dashboard before.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="mb-3.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                      {errorMessage}
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                    {/* New Password */}
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">
                        New password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">
                        Confirm new password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Requirements Checkmarks */}
                    <div className="space-y-1 py-0.5 text-[11px] sm:text-xs">
                      <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                        <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                        <span>At least 12 characters</span>
                      </div>
                      <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                        <Check className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                        <span>One number</span>
                      </div>
                      <div className={`flex items-center gap-2 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                        <Check className={`w-3.5 h-3.5 ${hasSymbol ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                        <span>One symbol</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-[#6B7280]'}`}>
                        <Check className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600 stroke-[3]' : 'text-[#9CA3AF]'}`} />
                        <span>Passwords match</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating password...</span>
                        </>
                      ) : (
                        <span>Update password</span>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 5: PASSWORD UPDATED */}
          {/* ======================================================== */}
          {view === 'PASSWORD_UPDATED' && (
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3.5 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              <h2 className="text-xl sm:text-[22px] font-bold text-[#111827] tracking-tight">
                Password updated
              </h2>
              <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1.5 leading-relaxed max-w-sm mx-auto">
                Your password has been changed. Sign in with your new password to continue.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/login', { replace: true });
                    setView('SIGN_IN');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 6: SIGNED OUT */}
          {/* ======================================================== */}
          {view === 'SIGNED_OUT' && (
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-neutral-100 text-[#4B5563] flex items-center justify-center mx-auto mb-3.5">
                <LogOut className="w-5 h-5" />
              </div>

              <h2 className="text-xl sm:text-[22px] font-bold text-[#111827] tracking-tight">
                You've signed out
              </h2>
              <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1.5 leading-relaxed max-w-sm mx-auto">
                If you're on a shared device, close this browser window to finish.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setView('SIGN_IN')}
                  className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer"
                >
                  Sign in again
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 7: SESSION EXPIRED */}
          {/* ======================================================== */}
          {view === 'SESSION_EXPIRED' && (
            <div>
              <div className="text-center mb-4">
                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-100">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="text-xl sm:text-[22px] font-bold text-[#111827]">Session expired</h2>
                <p className="text-xs sm:text-[13px] text-[#4B5563] mt-1 leading-normal">
                  You were signed out after a period of inactivity. Sign in again to pick up where you left off.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-[#E32032] flex-shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">
                    {errorMessage}
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="priya.shah@greenvalley.example"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] transition-all bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="••••••••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#D1D5DB] text-xs sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E32032] focus:border-[#E32032] transition-all bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] transition-colors p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#E32032] hover:bg-[#C71828] text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>

                <div className="text-center pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setPassword('');
                      setView('SIGN_IN');
                    }}
                    className="text-xs font-semibold text-[#374151] hover:text-[#111827] transition-colors"
                  >
                    Sign in with a different account
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Bottom Footer: Official PowerTech Energy attribution - centered in the middle of right half */}
        <div className="w-full pt-4 border-t border-[#F3F4F6] flex items-center justify-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#6B7280] font-medium">by</span>
          <img
            src={BRAND_ASSETS.powertechFullLogo}
            alt="PowerTech Energy"
            className="h-4 sm:h-4.5 w-auto object-contain opacity-90"
          />
        </div>
      </div>
    </div>
  );
};
