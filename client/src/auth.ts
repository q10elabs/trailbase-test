// Authentication operations and token management
// Handles login, signup, logout, OAuth, and token refresh

import { initClientFromCookies, initClient, type Tokens } from 'trailbase';
import { client, setClient, setRefreshIntervalId, getRefreshIntervalId, getSubscriptionReader, setSubscriptionReader } from './state';
import { TRAILBASE_URL, REFRESH_INTERVAL_MS } from './config';
import { showLoginSection, showCounterSection, loginError, loginBtn, signupBtn, emailInput, passwordInput, showError, hideError } from './ui';
import { loadCounter, subscribeToCounter } from './counter';
import { loadBackgroundImage } from './backgroundImage';
import { generatePkcePair, storePkceVerifier } from './pkce';

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

export async function handleOAuth(provider: string) {
  try {
    // Generate PKCE verifier and challenge
    const { verifier, challenge } = await generatePkcePair();
    
    // Store verifier in sessionStorage for retrieval after redirect
    // Only one OAuth flow can be active at a time, so we use a single storage key
    storePkceVerifier(verifier);
    
    // Build OAuth login URL with PKCE parameters
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      response_type: 'code',
      pkce_code_challenge: challenge,
    });
    
    // Redirect to TrailBase OAuth login with PKCE
    window.location.href = `${TRAILBASE_URL}/api/auth/v1/oauth/${provider}/login?${params.toString()}`;
  } catch (err) {
    console.error('Failed to initiate OAuth flow:', err);
    showError(loginError, 'Failed to start OAuth login. Please try again.');
  }
}

/**
 * Exchange authorization code and PKCE verifier for authentication tokens.
 * 
 * @param authorizationCode - Authorization code received from OAuth callback
 * @param pkceVerifier - PKCE code verifier that was used to generate the challenge
 * @returns Promise resolving to tokens, or null if exchange failed
 */
export async function exchangeAuthCodeForTokens(
  authorizationCode: string,
  pkceVerifier: string
): Promise<Tokens | null> {
  try {
    const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: authorizationCode,
        pkce_code_verifier: pkceVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);
      return null;
    }

    const tokens: Tokens = await response.json();
    return tokens;
  } catch (err) {
    console.error('Error exchanging authorization code for tokens:', err);
    return null;
  }
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

/**
 * Initialize client with tokens (used after PKCE token exchange).
 */
export async function initializeClientWithTokens(tokens: Tokens) {
  try {
    const newClient = initClient(TRAILBASE_URL, {
      tokens,
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
    console.error('Failed to initialize client with tokens:', err);
    throw err;
  }
}
