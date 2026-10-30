import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Production session idle timeout: strictly 15 minutes (900,000 ms)
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVE_KEY = 'foodie_last_active_time';
const THROTTLE_INTERVAL_MS = 3000; // Throttle activity writes to localStorage to every 3 seconds

export const SessionTimeoutTracker: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastWriteRef = useRef<number>(Date.now());

  useEffect(() => {
    // Only track idle session timeout when the user is logged in
    if (!isAuthenticated) return;

    // Initialize last active timestamp on login
    const initialNow = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, initialNow.toString());
    lastWriteRef.current = initialNow;

    // Get effective timeout (supports optional dev override: window.__FOODIE_SESSION_TIMEOUT_MS__)
    const getEffectiveTimeout = (): number => {
      const devOverride = (window as any).__FOODIE_SESSION_TIMEOUT_MS__;
      return typeof devOverride === 'number' && devOverride > 0 ? devOverride : IDLE_TIMEOUT_MS;
    };

    const handleExpire = () => {
      const userEmail = user?.email || '';
      // Save current page path so user picks up right where they left off upon signing in
      if (location.pathname && location.pathname !== '/login') {
        sessionStorage.setItem('foodie_redirect_after_login', location.pathname + location.search);
      }
      sessionStorage.setItem('foodie_session_expired', 'true');
      if (userEmail) {
        sessionStorage.setItem('foodie_expired_email', userEmail);
      }
      localStorage.removeItem(LAST_ACTIVE_KEY);
      logout();
      navigate(`/login?view=expired${userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''}`, {
        replace: true,
      });
    };

    const checkInactivity = () => {
      const storedTimeStr = localStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = storedTimeStr ? Number(storedTimeStr) : Date.now();
      const elapsed = Date.now() - lastActive;
      const timeoutLimit = getEffectiveTimeout();

      if (elapsed >= timeoutLimit) {
        handleExpire();
      }
    };

    // Throttled activity recorder across all user interactions
    const recordUserActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current > THROTTLE_INTERVAL_MS) {
        lastWriteRef.current = now;
        localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
      }
    };

    // High-fidelity user interaction listeners (keyboard, mouse, touch, scroll)
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, recordUserActivity, { passive: true });
    });

    // Check periodically every 5 seconds
    const intervalId = window.setInterval(checkInactivity, 5000);

    // Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        lastWriteRef.current = Number(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Immediate check when waking from system sleep or switching back to the tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, recordUserActivity);
      });
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, user, logout, navigate, location]);

  return null;
};
