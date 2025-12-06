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
const backgroundImageInput = document.getElementById('background-image-input') as HTMLInputElement;
const uploadImageBtn = document.getElementById('upload-image-btn')!;
const container = document.querySelector('.container') as HTMLElement;

let client = initClient(TRAILBASE_URL);
let subscriptionReader: ReadableStreamDefaultReader | null = null;
let backgroundImageRecordId: number | null = null;
let refreshIntervalId: number | null = null;

// Token refresh interval: 5 minutes (300000 ms)
// Auth tokens expire after 60 minutes, so refreshing every 5 minutes ensures
// we refresh well before expiration (12 refreshes per token lifetime)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Token refresh and auth state management
async function attemptTokenRefresh(): Promise<boolean> {
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

function startTokenRefreshInterval() {
  // Clear any existing interval
  stopTokenRefreshInterval();

  // Set up periodic refresh
  refreshIntervalId = window.setInterval(async () => {
    const success = await attemptTokenRefresh();
    if (!success) {
      // Auth lost, redirect to login
      stopTokenRefreshInterval();
      showLoginSection();
    }
  }, REFRESH_INTERVAL_MS);
}

function stopTokenRefreshInterval() {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// Handle page visibility changes (sleep/wake scenarios)
function handleVisibilityChange() {
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

// Initialize: Check for existing session
async function init() {
  try {
    // Set up auth change callback to handle logout
    client = await initClientFromCookies(TRAILBASE_URL, {
      onAuthChange: (client, user) => {
        if (!user) {
          // User was logged out (e.g., refresh failed with 401)
          stopTokenRefreshInterval();
          showLoginSection();
        }
      },
    });
    
    const user = client.user();
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
    stopTokenRefreshInterval();
    if (subscriptionReader) {
      await subscriptionReader.cancel();
      subscriptionReader = null;
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

// Image processing utilities
async function convertImageToWebP(file: File, maxSizeBytes: number = 1024 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      // Start with original dimensions
      let width = img.width;
      let height = img.height;
      let quality = 0.9;

      const resizeAndCompress = () => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            // If blob is too large, reduce quality or size
            if (blob.size > maxSizeBytes && quality > 0.1) {
              // First try reducing quality
              if (quality > 0.3) {
                quality -= 0.1;
                resizeAndCompress();
              } else {
                // Then reduce dimensions
                width = Math.floor(width * 0.9);
                height = Math.floor(height * 0.9);
                quality = 0.9; // Reset quality for new size
                resizeAndCompress();
              }
            } else {
              resolve(blob);
            }
          },
          'image/webp',
          quality
        );
      };

      resizeAndCompress();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

// Background image operations
async function loadBackgroundImage() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('user_background_images');
    
    // Try to find existing background image for this user
    const result = await api.list({
      limit: 1,
    });

    if (result.records && result.records.length > 0) {
      const record = result.records[0] as { id: number; background_image?: { filename?: string } };
      backgroundImageRecordId = record.id;
      
      if (record.background_image?.filename) {
        // Construct the file URL (no cache-busting needed on initial load)
        const fileUrl = `${TRAILBASE_URL}/api/records/v1/user_background_images/${record.id}/file/background_image`;
        // Set background image on the ::before pseudo-element
        const style = document.createElement('style');
        style.textContent = `
          .container::before {
            background-image: url(${fileUrl});
          }
        `;
        // Remove existing style if any
        const existingStyle = document.getElementById('bg-image-style');
        if (existingStyle) {
          existingStyle.remove();
        }
        style.id = 'bg-image-style';
        document.head.appendChild(style);
      }
    }
  } catch (err: any) {
    console.error('Error loading background image:', err);
    // Don't show error to user, just log it
  }
}

async function uploadBackgroundImage() {
  try {
    const user = client.user();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const file = backgroundImageInput.files?.[0];
    if (!file) {
      showError(counterError, 'Please select an image file');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError(counterError, 'Please select a valid image file');
      return;
    }

    hideError(counterError);
    uploadImageBtn.disabled = true;

    // Convert to WebP and resize to max 1MB
    const webpBlob = await convertImageToWebP(file, 1024 * 1024);
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('user', user.id);
    formData.append('background_image', webpBlob, 'background.webp');

    // Check if we have an existing record
    const api = client.records('user_background_images');
    let recordId: number;

    if (backgroundImageRecordId) {
      // Update existing record
      recordId = backgroundImageRecordId;
      
      // For multipart update, use client.fetch to ensure authentication headers are included
      const response = await client.fetch(`/api/records/v1/user_background_images/${recordId}`, {
        method: 'PATCH',
        body: formData,
        throwOnError: false,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update background image');
      }
    } else {
      // Create new record
      const response = await client.fetch('/api/records/v1/user_background_images', {
        method: 'POST',
        body: formData,
        throwOnError: false,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to upload background image');
      }

      const result = await response.json() as { ids: number[] };
      recordId = result.ids[0];
      backgroundImageRecordId = recordId;
    }

    // Update the background image display
    // Add cache-busting parameter to force browser to reload the image
    const cacheBuster = Date.now();
    const fileUrl = `${TRAILBASE_URL}/api/records/v1/user_background_images/${recordId}/file/background_image?t=${cacheBuster}`;
    
    // Remove existing style first to force re-render
    const existingStyle = document.getElementById('bg-image-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Force a reflow to ensure the old style is removed
    void container.offsetHeight;
    
    // Set background image on the ::before pseudo-element
    const style = document.createElement('style');
    style.id = 'bg-image-style';
    style.textContent = `
      .container::before {
        background-image: url("${fileUrl}");
      }
    `;
    document.head.appendChild(style);

    // Clear the file input
    backgroundImageInput.value = '';
  } catch (err: any) {
    console.error('Error uploading background image:', err);
    showError(counterError, err.message || 'Failed to upload background image');
  } finally {
    uploadImageBtn.disabled = false;
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
