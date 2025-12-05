// TrailBase Counter Experiment - Client Application
// Main application logic for the counter experiment

import { initClient, initClientFromCookies } from 'trailbase';

const TRAILBASE_URL = 'http://localhost:7000';

// UI Elements
const loginSection = document.getElementById('login-section')!;
const counterSection = document.getElementById('counter-section')!;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn')!;
const signupBtn = document.getElementById('signup-btn')!;
const logoutBtn = document.getElementById('logout-btn')!;
const incrementBtn = document.getElementById('increment-btn')!;
const counterValue = document.getElementById('counter-value')!;
const userEmail = document.getElementById('user-email')!;
const loginError = document.getElementById('login-error')!;
const counterError = document.getElementById('counter-error')!;
const oauthGoogleBtn = document.getElementById('oauth-google-btn')!;
const oauthDiscordBtn = document.getElementById('oauth-discord-btn')!;

let client = initClient(TRAILBASE_URL);
let subscriptionReader: ReadableStreamDefaultReader | null = null;

// Initialize: Check for existing session
async function init() {
  try {
    client = await initClientFromCookies(TRAILBASE_URL);
    const user = client.user();
    if (user) {
      showCounterSection(user.email);
      await loadCounter();
      await subscribeToCounter();
    } else {
      showLoginSection();
    }
  } catch (err) {
    console.debug('No existing session:', err);
    showLoginSection();
  }
}

// Show/hide sections
function showLoginSection() {
  loginSection.classList.remove('hidden');
  counterSection.classList.add('hidden');
  emailInput.value = '';
  passwordInput.value = '';
  hideError(loginError);
}

function showCounterSection(email: string) {
  loginSection.classList.add('hidden');
  counterSection.classList.remove('hidden');
  userEmail.textContent = email;
  hideError(counterError);
}

function showError(element: HTMLElement, message: string) {
  element.textContent = message;
  element.classList.add('show');
}

function hideError(element: HTMLElement) {
  element.classList.remove('show');
  element.textContent = '';
}

// Authentication
async function handleLogin() {
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
    }
  } catch (err: any) {
    showError(loginError, err.message || 'Login failed. Please check your credentials.');
  } finally {
    loginBtn.disabled = false;
    signupBtn.disabled = false;
  }
}

async function handleSignup() {
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

async function handleLogout() {
  try {
    if (subscriptionReader) {
      await subscriptionReader.cancel();
      subscriptionReader = null;
    }
    await client.logout();
    showLoginSection();
  } catch (err) {
    console.error('Logout error:', err);
    // Still show login section even if logout fails
    showLoginSection();
  }
}

function handleOAuth(provider: string) {
  // Redirect to TrailBase OAuth login
  window.location.href = `${TRAILBASE_URL}/api/auth/v1/oauth/${provider}/login?redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
}

// Counter operations
async function loadCounter() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('counters');
    
    // Try to find existing counter for this user
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      limit: 1,
    });

    if (result.records && result.records.length > 0) {
      const counter = result.records[0] as { counter_value: number };
      counterValue.textContent = counter.counter_value.toString();
    } else {
      // Create counter if it doesn't exist
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      await api.create({
        user: user.id,
        counter_value: 0,
      });
      counterValue.textContent = '0';
    }
  } catch (err: any) {
    console.error('Error loading counter:', err);
    showError(counterError, err.message || 'Failed to load counter');
  }
}

async function incrementCounter() {
  try {
    hideError(counterError);
    incrementBtn.disabled = true;

    const user = client.user();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const api = client.records('counters');
    
    // Find user's counter
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      limit: 1,
    });

    if (!result.records || result.records.length === 0) {
      // Create counter if it doesn't exist
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      await api.create({
        user: user.id,
        counter_value: 1,
      });
      counterValue.textContent = '1';
    } else {
      const counter = result.records[0] as { id: number; counter_value: number };
      const newValue = (counter.counter_value || 0) + 1;
      
      // Update counter
      await api.update(counter.id, {
        counter_value: newValue,
      });
      
      // Update UI immediately (realtime subscription will also update it)
      counterValue.textContent = newValue.toString();
    }
  } catch (err: any) {
    console.error('Error incrementing counter:', err);
    showError(counterError, err.message || 'Failed to increment counter');
  } finally {
    incrementBtn.disabled = false;
  }
}

async function subscribeToCounter() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('counters');
    
    // Find user's counter ID
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      limit: 1,
    });

    if (!result.records || result.records.length === 0) {
      // No counter yet, create one
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      const created = await api.create({
        user: user.id,
        counter_value: 0,
      });
      if (created && created.id) {
        subscribeToCounterById(created.id);
      }
    } else {
      const counter = result.records[0] as { id: number };
      subscribeToCounterById(counter.id);
    }
  } catch (err) {
    console.error('Error setting up subscription:', err);
  }
}

async function subscribeToCounterById(counterId: number) {
  try {
    // Cancel existing subscription if any
    if (subscriptionReader) {
      await subscriptionReader.cancel();
    }

    const api = client.records('counters');
    const stream = await api.subscribe(counterId);
    subscriptionReader = stream.getReader();

    // Read updates from stream
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await subscriptionReader!.read();
          if (done) {
            console.log('Subscription ended');
            break;
          }

          // Handle update event
          const update = value as { Update?: { counter_value?: number } };
          if (update.Update?.counter_value !== undefined) {
            counterValue.textContent = update.Update.counter_value.toString();
          }
        }
      } catch (err) {
        console.error('Subscription error:', err);
        // Try to reconnect after a delay
        setTimeout(() => {
          subscribeToCounter();
        }, 5000);
      }
    };

    readLoop();
  } catch (err) {
    console.error('Error subscribing to counter:', err);
  }
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

// Initialize app
checkOAuthCallback();
init();
