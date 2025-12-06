// UI element references and manipulation functions
// Handles DOM element access and UI state changes

// UI Elements
export const loginSection = document.getElementById('login-section')!;
export const counterSection = document.getElementById('counter-section')!;
export const emailInput = document.getElementById('email') as HTMLInputElement;
export const passwordInput = document.getElementById('password') as HTMLInputElement;
export const loginBtn = document.getElementById('login-btn')! as HTMLButtonElement;
export const signupBtn = document.getElementById('signup-btn')! as HTMLButtonElement;
export const logoutBtn = document.getElementById('logout-btn')! as HTMLButtonElement;
export const incrementBtn = document.getElementById('increment-btn')! as HTMLButtonElement;
export const counterValue = document.getElementById('counter-value')!;
export const userEmail = document.getElementById('user-email')!;
export const loginError = document.getElementById('login-error')!;
export const counterError = document.getElementById('counter-error')!;
export const oauthGoogleBtn = document.getElementById('oauth-google-btn')!;
export const oauthDiscordBtn = document.getElementById('oauth-discord-btn')!;
export const backgroundImageInput = document.getElementById('background-image-input') as HTMLInputElement;
export const uploadImageBtn = document.getElementById('upload-image-btn')! as HTMLButtonElement;
export const container = document.querySelector('.container') as HTMLElement;

// Show/hide sections
export function showLoginSection() {
  loginSection.classList.remove('hidden');
  counterSection.classList.add('hidden');
  emailInput.value = '';
  passwordInput.value = '';
  hideError(loginError);
}

export function showCounterSection(email: string) {
  loginSection.classList.add('hidden');
  counterSection.classList.remove('hidden');
  userEmail.textContent = email;
  hideError(counterError);
}

export function showError(element: HTMLElement, message: string) {
  element.textContent = message;
  element.classList.add('show');
}

export function hideError(element: HTMLElement) {
  element.classList.remove('show');
  element.textContent = '';
}
