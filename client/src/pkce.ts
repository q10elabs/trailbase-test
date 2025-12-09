// PKCE (Proof Key for Code Exchange) utilities
// Generates PKCE verifier/challenge pairs for OAuth authentication flows

import { urlSafeBase64Encode } from 'trailbase';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Generates a PKCE code verifier and challenge pair.
 * 
 * The verifier is a cryptographically random string (43-128 characters).
 * The challenge is the base64url-encoded SHA256 hash of the verifier.
 * 
 * @param length - Length of random bytes to generate (32-96, default 32)
 * @returns Promise resolving to PKCE pair with verifier and challenge
 */
export async function generatePkcePair(length: number = 32): Promise<PkcePair> {
  if (length < 32 || length > 96) {
    throw new Error('PKCE verifier length must be between 32 and 96 bytes');
  }

  // Generate random verifier bytes
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Encode verifier as base64url (no padding)
  const verifier = urlSafeBase64Encode(randomBytes).replace(/=/g, '');

  // Compute SHA256 hash of verifier
  const encoder = new TextEncoder();
  const verifierBytes = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', verifierBytes);

  // Encode challenge as base64url (no padding)
  const challenge = urlSafeBase64Encode(new Uint8Array(hashBuffer)).replace(/=/g, '');

  return { verifier, challenge };
}

const PKCE_STORAGE_KEY = 'trailbase_pkce_verifier';

/**
 * Store PKCE verifier in sessionStorage for later retrieval after OAuth redirect.
 * Only one OAuth flow can be active at a time (user is redirected away),
 * so we use a single storage key.
 */
export function storePkceVerifier(verifier: string): void {
  try {
    sessionStorage.setItem(PKCE_STORAGE_KEY, verifier);
  } catch {
    // Ignore errors (e.g., in private browsing mode)
  }
}

/**
 * Retrieve PKCE verifier from sessionStorage.
 * Returns null if not found or if storage is unavailable.
 */
export function getPkceVerifier(): string | null {
  try {
    return sessionStorage.getItem(PKCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear PKCE verifier from sessionStorage after successful token exchange.
 */
export function clearPkceVerifier(): void {
  try {
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
  } catch {
    // Ignore errors (e.g., in private browsing mode)
  }
}
