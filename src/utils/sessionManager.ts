/**
 * Session Manager - Handles secure storage and retrieval of session data
 * 
 * This utility provides methods for:
 * - Encrypting session data and storing it in localStorage
 * - Retrieving and decrypting session data from localStorage
 * - Checking session validity and expiration
 * - Automatically clearing expired sessions
 */

import { encryptData, decryptData } from './sessionEncryption';

// Session Configuration
const SESSION_EXPIRY_MS = 3600000; // 1 hour
const SESSION_KEY = 'wallet_session';
const SESSION_VERSION = 3; // Updated for public-only address support

// Session data interface
export interface SessionData {
  publicAddress: string;  // Public address for identification
  verifiedAt: string;     // ISO timestamp
  expiresAt: string;      // ISO timestamp
  version: number;
}

/**
 * Creates and stores an encrypted session
 * @param publicAddress The verified public address to use for identification
 * @returns True if session was successfully stored
 */
export const createSession = async (
  publicAddress: string
): Promise<boolean> => {
  try {
    if (!publicAddress) {
      console.error('Cannot create session without a public address');
      return false;
    }
    
    // Validate address format
    if (!publicAddress.startsWith('addr1') && !publicAddress.startsWith('addr_test1')) {
      console.error('Invalid public address format, must start with addr1 or addr_test1');
      return false;
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + SESSION_EXPIRY_MS);

    const sessionData: SessionData = {
      publicAddress,
      verifiedAt: now.toISOString(),
      expiresAt: expiryDate.toISOString(),
      version: SESSION_VERSION
    };

    // Encrypt session data using AES-GCM
    const encryptedSession = await encryptData(JSON.stringify(sessionData));
    if (!encryptedSession) {
      throw new Error('Session encryption failed');
    }
    
    localStorage.setItem(SESSION_KEY, encryptedSession);
    
    console.log(`✅ Session created for ${publicAddress.substring(0, 10)}... valid until ${expiryDate.toLocaleTimeString()}`);
    return true;
  } catch (error) {
    console.error('Failed to create session:', error);
    return false;
  }
};

/**
 * Retrieves the current session if valid
 * @returns The session data if valid, null otherwise
 */
export const getSession = async (): Promise<SessionData | null> => {
  try {
    const encryptedSession = localStorage.getItem(SESSION_KEY);
    if (!encryptedSession) {
      return null;
    }

    // Decrypt and parse the session
    const decryptedSession = await decryptData(encryptedSession);
    if (!decryptedSession) {
      console.warn('Failed to decrypt session data, clearing session');
      clearSession();
      return null;
    }
    
    const sessionData: SessionData = JSON.parse(decryptedSession);
    
    // Validate session format - require publicAddress
    if (!sessionData || !sessionData.publicAddress || !sessionData.expiresAt) {
      console.warn('Invalid session format detected, clearing session');
      clearSession();
      return null;
    }

    // Check session expiry
    const expiryDate = new Date(sessionData.expiresAt);
    if (expiryDate < new Date()) {
      console.log('Session expired, clearing');
      clearSession();
      return null;
    }

    // Calculate remaining time and log
    const remainingMs = expiryDate.getTime() - new Date().getTime();
    const remainingMinutes = Math.floor(remainingMs / 60000);
    console.log(`✅ Valid session found for ${sessionData.publicAddress.substring(0, 10)}... (${remainingMinutes} minutes remaining)`);
    
    return sessionData;
  } catch (error) {
    console.error('Error retrieving session:', error);
    clearSession();
    return null;
  }
};

/**
 * Clears the current session
 */
export const clearSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

/**
 * Calculates the remaining time of the current session in milliseconds
 * @returns Time remaining in milliseconds, or 0 if no valid session exists
 */
export const getSessionRemainingMs = async (): Promise<number> => {
  const session = await getSession();
  if (!session) {
    return 0;
  }

  const expiryDate = new Date(session.expiresAt);
  const remainingMs = expiryDate.getTime() - new Date().getTime();
  return Math.max(0, remainingMs);
};

/**
 * Refreshes the current session if it's valid
 * @returns True if refresh was successful
 */
export const refreshSession = async (): Promise<boolean> => {
  const currentSession = await getSession();
  if (!currentSession) {
    return false;
  }

  return await createSession(currentSession.publicAddress);
};

/**
 * Validates if the provided address matches the current session
 * @param address The address to validate
 * @returns True if the session exists and matches the address
 */
export const validateSessionForAddress = async (address: string): Promise<boolean> => {
  if (!address) return false;
  
  const session = await getSession();
  return !!(session && session.publicAddress === address);
};

/**
 * Gets a session token for API authentication
 * This is a simplified version - in production, implement JWT or similar
 * @returns An encoded session token or null if no session exists
 */
export const getSessionToken = async (): Promise<string | null> => {
  const session = await getSession();
  if (!session) return null;
  
  // Create a simple token with expiry timestamp
  const token = `${session.publicAddress}:${new Date(session.expiresAt).getTime()}`;
  return btoa(token); // Basic encoding for API calls
}; 