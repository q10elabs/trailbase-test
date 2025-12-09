// TrailBase Counter Experiment - Client Application
// Main application initialization, event listeners, and OAuth callback handling

import { setClient } from './state';
import { initializeClient, handleLogin, handleSignup, handleLogout, handleOAuth, handleVisibilityChange, startTokenRefreshInterval, exchangeAuthCodeForTokens, initializeClientWithTokens } from './auth';
import { showLoginSection, showCounterSection, loginError, showError } from './ui';
import { loadCounter, subscribeToCounter, incrementCounter } from './counter';
import { loadBackgroundImage, uploadBackgroundImage } from './backgroundImage';
import { emailInput, passwordInput, loginBtn, signupBtn, logoutBtn, incrementBtn, oauthGoogleBtn, oauthDiscordBtn, uploadImageBtn } from './ui';
import { getPkceVerifier, clearPkceVerifier } from './pkce';

// Initialize: Check for existing session
async function init() {
  try {
    const newClient = await initializeClient();
    setClient(newClient);
    
    const user = newClient.user();
    if (user) {
      showCounterSection(user.email);
      await loadCounter();
      await subscribeToCounter();
      await loadBackgroundImage();
      startTokenRefreshInterval();
    } else {
      showLoginSection();
    }
  } catch (err) {
    console.debug('No existing session:', err);
    showLoginSection();
  }

  // Set up visibility change listener for sleep/wake detection
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Check for OAuth callback and handle PKCE token exchange
// Returns true if OAuth callback was handled, false otherwise
async function checkOAuthCallback(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    // Retrieve PKCE verifier from sessionStorage
    // Only one OAuth flow can be active at a time, so we use a single storage key
    const pkceVerifier = getPkceVerifier();
    
    if (pkceVerifier) {
      // Exchange authorization code for tokens using PKCE
      const tokens = await exchangeAuthCodeForTokens(code, pkceVerifier);
      
      if (tokens) {
        // Clear the PKCE verifier from storage
        clearPkceVerifier();
        
        // Initialize client with tokens
        try {
          const newClient = await initializeClientWithTokens(tokens);
          setClient(newClient);
          
          const user = newClient.user();
          if (user) {
            // Clean up URL by removing the code parameter
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
            
            // Show authenticated UI
            showCounterSection(user.email);
            await loadCounter();
            await subscribeToCounter();
            await loadBackgroundImage();
            startTokenRefreshInterval();
            return true; // OAuth callback was handled
          }
        } catch (err) {
          console.error('Failed to initialize client with tokens:', err);
          showError(loginError, 'Failed to complete login. Please try again.');
        }
      } else {
        // Token exchange failed
        clearPkceVerifier();
        showError(loginError, 'Failed to exchange authorization code. Please try logging in again.');
        // Clean up URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    } else {
      // No PKCE verifier found - fall back to cookie-based flow
      // This handles cases where OAuth was initiated without PKCE
      // or if the verifier was lost (e.g., sessionStorage cleared)
      console.debug('No PKCE verifier found, falling back to cookie-based flow');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      // Will proceed to init() which will check cookies
    }
  }
  
  // No OAuth callback or fallback to normal initialization
  return false;
}

// Event listeners
loginBtn.addEventListener('click', handleLogin);
signupBtn.addEventListener('click', handleSignup);
logoutBtn.addEventListener('click', handleLogout);
incrementBtn.addEventListener('click', incrementCounter);

// Allow Enter key to submit login
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    passwordInput.focus();
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

oauthGoogleBtn.addEventListener('click', () => handleOAuth('google'));
oauthDiscordBtn.addEventListener('click', () => handleOAuth('discord'));
uploadImageBtn.addEventListener('click', uploadBackgroundImage);

// Initialize app
// Handle OAuth callback first (async), then initialize normally
checkOAuthCallback().then((handled) => {
  if (!handled) {
    init();
  }
}).catch((err) => {
  console.error('Error handling OAuth callback:', err);
  // Fall back to normal initialization
  init();
});
