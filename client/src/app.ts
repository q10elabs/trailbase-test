// TrailBase Counter Experiment - Client Application
// Main application initialization, event listeners, and OAuth callback handling

import { setClient } from './state';
import { initializeClient, handleLogin, handleSignup, handleLogout, handleOAuth, handleVisibilityChange, startTokenRefreshInterval } from './auth';
import { showLoginSection, showCounterSection } from './ui';
import { loadCounter, subscribeToCounter, incrementCounter } from './counter';
import { loadBackgroundImage, uploadBackgroundImage } from './backgroundImage';
import { emailInput, passwordInput, loginBtn, signupBtn, logoutBtn, incrementBtn, oauthGoogleBtn, oauthDiscordBtn, uploadImageBtn } from './ui';

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

// Check for OAuth callback
function checkOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    // Handle OAuth callback
    // The code should be exchanged for tokens via the client
    // For now, we'll just reload the page after a short delay
    // In a production app, you'd exchange the code for tokens
    setTimeout(() => {
      window.location.href = window.location.pathname;
      init();
    }, 1000);
  } else {
    // No OAuth callback, proceed with normal initialization
    // (init() is called at the end of the file)
  }
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
checkOAuthCallback();
init();
