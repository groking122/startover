/**
 * Utilities for string manipulation and conversion
 */

/**
 * Convert a string to hexadecimal representation
 * Used for wallet signature payloads that require hex format
 */
export const toHex = (str: string): string =>
  Buffer.from(str, 'utf8').toString('hex');

/**
 * Convert a hexadecimal string back to UTF-8 string
 * Used for decoding hex payloads back to their original string format
 */
export const fromHex = (hex: string): string =>
  Buffer.from(hex, 'hex').toString('utf8'); 