// Authentication operations and token management
// Handles login, signup, logout, OAuth, and token refresh

import { initClientFromCookies } from 'trailbase';
import { client, setClient, setRefreshIntervalId, getRefreshIntervalId, getSubscriptionReader, setSubscriptionReader } from './state';
import { TRAILBASE_URL, REFRESH_INTERVAL_MS } from './config';
import { showLoginSection, showCounterSection, loginError, loginBtn, signupBtn, emailInput, passwordInput, showError, hideError } from './ui';
import { loadCounter, subscribeToCounter } from './counter';
import { loadBackgroundImage } from './backgroundImage';

// Token refresh and auth state management
export async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const user = client.user();
    if (!user) {
      return false;
    }

    await client.refreshAuthToken();
    
    // Check if user is still authenticated after refresh
    const userAfterRefresh = client.user();
    if (!userAfterRefresh) {
      // Refresh failed and user was logged out
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return false;
  }
}

export function startTokenRefreshInterval() {
  // Clear any existing interval
  stopTokenRefreshInterval();

  // Set up periodic refresh
  const intervalId = window.setInterval(async () => {
    const success = await attemptTokenRefresh();
    if (!success) {
      // Auth lost, redirect to login
      stopTokenRefreshInterval();
      showLoginSection();
    }
  }, REFRESH_INTERVAL_MS);
  
  setRefreshIntervalId(intervalId);
}

export function stopTokenRefreshInterval() {
  const intervalId = getRefreshIntervalId();
  if (intervalId !== null) {
    clearInterval(intervalId);
    setRefreshIntervalId(null);
  }
}

// Handle page visibility changes (sleep/wake scenarios)
export function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Page became visible - check auth status and refresh if needed
    const user = client.user();
    if (user) {
      // Attempt to refresh token
      attemptTokenRefresh().then((success) => {
        if (!success) {
          // Auth lost, redirect to login
          stopTokenRefreshInterval();
          showLoginSection();
        }
      });
    } else {
      // No user, ensure we're showing login
      stopTokenRefreshInterval();
      showLoginSection();
    }
  }
}

// Authentication
export async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError(loginError, 'Please enter both email and password');
    return;
  }

  try {
    hideError(loginError);
    loginBtn.disabled = true;
    signupBtn.disabled = true;

    await client.login(email, password);
    const user = client.user();
    if (user) {
      showCounterSection(user.email);
      await loadCounter();
      await subscribeToCounter();
      await loadBackgroundImage();
      startTokenRefreshInterval();
    }
  } catch (err: any) {
    showError(loginError, err.message || 'Login failed. Please check your credentials.');
  } finally {
    loginBtn.disabled = false;
    signupBtn.disabled = false;
  }
}

export async function handleSignup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError(loginError, 'Please enter both email and password');
    return;
  }

  if (password.length < 8) {
    showError(loginError, 'Password must be at least 8 characters');
    return;
  }

  try {
    hideError(loginError);
    loginBtn.disabled = true;
    signupBtn.disabled = true;

    // Register new user
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('password_repeat', password);

    const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Registration failed');
    }

    // After registration, user needs to verify email, but for development
    // we can try to log in (if email verification is disabled)
    showError(loginError, 'Registration successful! Please check your email for verification, then login.');
  } catch (err: any) {
    showError(loginError, err.message || 'Registration failed');
  } finally {
    loginBtn.disabled = false;
    signupBtn.disabled = false;
  }
}

export async function handleLogout() {
  try {
    stopTokenRefreshInterval();
    const reader = getSubscriptionReader();
    if (reader) {
      await reader.cancel();
      setSubscriptionReader(null);
    }
    await client.logout();
    showLoginSection();
  } catch (err) {
    console.error('Logout error:', err);
    // Still show login section even if logout fails
    stopTokenRefreshInterval();
    showLoginSection();
  }
}

export function handleOAuth(provider: string) {
  // Redirect to TrailBase OAuth login
  window.location.href = `${TRAILBASE_URL}/api/auth/v1/oauth/${provider}/login?redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
}

// Initialize client from cookies
export async function initializeClient() {
  try {
    // Set up auth change callback to handle logout
    const newClient = await initClientFromCookies(TRAILBASE_URL, {
      onAuthChange: (_client, user) => {
        if (!user) {
          // User was logged out (e.g., refresh failed with 401)
          stopTokenRefreshInterval();
          showLoginSection();
        }
      },
    });
    
    setClient(newClient);
    return newClient;
  } catch (err) {
    console.debug('No existing session:', err);
    throw err;
  }
}
