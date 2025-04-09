'use client';

/**
 * Session Encryption Utility
 * 
 * Provides secure AES-GCM encryption for session data using the Web Crypto API
 * Note: This is only available in client-side code as it relies on browser APIs
 */

// Convert array buffer to hex string
const bufToHex = (buf: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Converts a hex string to a Uint8Array
 * @param hex Hexadecimal string to convert
 * @returns Uint8Array containing the binary data
 */
export const hexToBuf = (hex: string): Uint8Array => {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
};

/**
 * Safely converts a Uint8Array to an ArrayBuffer
 * This handles the TypeScript compatibility issues with Web Crypto API
 * @param buf Uint8Array to convert
 * @returns A properly detached ArrayBuffer
 */
const toArrayBuffer = (buf: Uint8Array): ArrayBuffer => {
  // Create a new ArrayBuffer and copy the data
  const arrayBuffer = new ArrayBuffer(buf.byteLength);
  new Uint8Array(arrayBuffer).set(buf);
  return arrayBuffer;
};

// Generate a device-specific key (combining browser fingerprint with app name)
// Note: This is not perfect security, but better than nothing for client-side storage
const getEncryptionKey = async (): Promise<CryptoKey> => {
  try {
    // Create a device fingerprint - this is simple but can be enhanced
    const browserInfo = [
      navigator.userAgent,
      navigator.language,
      'wallet-chat-app', // App specific salt
      window.screen.colorDepth,
      window.screen.height,
      window.screen.width
    ].join('|');
    
    // Create a deterministic key based on the device fingerprint
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(browserInfo);
    
    // Generate a key from the fingerprint
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Use PBKDF2 to derive a stronger key
    const salt = encoder.encode('cardano-wallet-chat-salt');
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to generate encryption key:', error);
    throw new Error('Encryption setup failed');
  }
};

/**
 * Encrypts a string value using AES-GCM
 * @param plaintext The data to encrypt
 * @returns Encrypted data as hex string (includes IV)
 */
export const encryptData = async (plaintext: string): Promise<string> => {
  try {
    // Get encryption key
    const key = await getEncryptionKey();
    
    // Create random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivBuffer = toArrayBuffer(iv);
    
    // Encode the plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Format as: iv + ciphertext (both as hex)
    return bufToHex(ivBuffer) + bufToHex(encryptedBuffer);
  } catch (error) {
    console.error('Encryption failed:', error);
    return ''; // Return empty on error
  }
};

/**
 * Decrypts an AES-GCM encrypted string
 * @param ciphertext The encrypted data (hex string with IV prepended)
 * @returns Decrypted string or null if decryption fails
 */
export const decryptData = async (ciphertext: string): Promise<string | null> => {
  try {
    if (!ciphertext || ciphertext.length < 24) {
      return null;
    }
    
    // Get encryption key
    const key = await getEncryptionKey();
    
    // Extract IV (first 24 hex chars = 12 bytes)
    const ivHex = ciphertext.substring(0, 24);
    const iv = hexToBuf(ivHex);
    
    // Extract ciphertext
    const encryptedHex = ciphertext.substring(24);
    const encryptedData = hexToBuf(encryptedHex);
    const encryptedBuffer = toArrayBuffer(encryptedData);
    
    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBuffer
    );
    
    // Decode the result
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}; 