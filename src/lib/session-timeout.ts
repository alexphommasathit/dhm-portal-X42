import { createClientComponentSupabase } from '@/lib/supabase/client';
import { auditLogger } from './audit-logger';

// HIPAA requires automatic session timeouts for inactivity
// These constants define our timeout periods
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes before timeout
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

// Track last activity
let lastActivity = Date.now();
let timeoutWarningShown = false;
let logoutTimer: NodeJS.Timeout | null = null;
let checkActivityTimer: NodeJS.Timeout | null = null;
let timeoutCallback: (() => void) | null = null;
let warningCallback: (() => void) | null = null;

/**
 * Initializes the session timeout mechanism
 *
 * @param onTimeout - Callback function to execute when session times out
 * @param onWarning - Callback function to execute when timeout warning is shown
 */
export function initSessionTimeout(
  onTimeout: () => void = defaultTimeoutHandler,
  onWarning: () => void = defaultWarningHandler
) {
  // Store callbacks
  timeoutCallback = onTimeout;
  warningCallback = onWarning;

  // Reset and start the timer
  resetActivityTimer();

  // Setup activity listeners to detect user interaction
  setupActivityListeners();

  // Start periodic check for inactivity
  startPeriodicCheck();

  console.log('HIPAA-compliant session timeout initialized');
}

/**
 * Updates the last activity timestamp
 */
export function updateActivity() {
  lastActivity = Date.now();

  // If warning was shown and user is now active, hide it
  if (timeoutWarningShown) {
    timeoutWarningShown = false;
    // We could call a callback here to hide any warning UI
  }
}

/**
 * Set up listeners for user activity
 */
function setupActivityListeners() {
  if (typeof window !== 'undefined') {
    // Reset timer on user interaction
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Also reset when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    });
  }
}

/**
 * Start periodic check for inactivity
 */
function startPeriodicCheck() {
  if (checkActivityTimer) {
    clearInterval(checkActivityTimer);
  }

  checkActivityTimer = setInterval(() => {
    const inactiveTime = Date.now() - lastActivity;

    // Check if we should show warning
    if (inactiveTime >= SESSION_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS && !timeoutWarningShown) {
      timeoutWarningShown = true;

      if (warningCallback) {
        warningCallback();
      }
    }

    // Check if we should timeout the session
    if (inactiveTime >= SESSION_TIMEOUT_MS) {
      if (timeoutCallback) {
        timeoutCallback();
      }
    }
  }, ACTIVITY_CHECK_INTERVAL_MS);
}

/**
 * Reset the activity timer
 */
function resetActivityTimer() {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
  }

  lastActivity = Date.now();
  timeoutWarningShown = false;

  // Set a hard timeout as a fallback
  logoutTimer = setTimeout(() => {
    if (timeoutCallback) {
      timeoutCallback();
    }
  }, SESSION_TIMEOUT_MS);
}

/**
 * Stop all timers (use when manually logging out)
 */
export function stopSessionTimeout() {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }

  if (checkActivityTimer) {
    clearInterval(checkActivityTimer);
    checkActivityTimer = null;
  }

  if (typeof window !== 'undefined') {
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      window.removeEventListener(event, updateActivity);
    });
  }

  console.log('Session timeout monitoring stopped');
}

/**
 * Default timeout handler - performs automatic sign out
 */
async function defaultTimeoutHandler() {
  console.log('Session timed out due to inactivity');

  try {
    // Get current user before signing out for audit log
    const supabase = createClientComponentSupabase();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    // Log the automatic logout
    if (user) {
      await auditLogger.logAuth(
        user.id,
        {
          reason: 'automatic_timeout',
          inactive_minutes: SESSION_TIMEOUT_MS / (60 * 1000),
        },
        true
      );
    }

    // Sign out
    await supabase.auth.signOut();

    // Redirect to login page
    window.location.href = '/login?timeout=true';
  } catch (err) {
    console.error('Error during automatic session timeout:', err);

    // Force redirect even if sign out fails
    window.location.href = '/login?timeout=true&error=true';
  }
}

/**
 * Default warning handler - shows an alert
 */
function defaultWarningHandler() {
  console.log('Session timeout warning');

  // In a real app, you might show a modal dialog instead of an alert
  if (typeof window !== 'undefined') {
    const remainingMinutes = Math.ceil(WARNING_BEFORE_TIMEOUT_MS / 60000);
    alert(
      `Your session will expire due to inactivity in ${remainingMinutes} minute(s). Please click OK and continue working to stay logged in.`
    );

    // Clicking OK on the alert counts as activity
    updateActivity();
  }
}
