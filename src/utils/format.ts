/**
 * Utility functions for formatting text and addresses
 */

/**
 * Safely shortens an address or other long string for display
 * Returns the first 8 characters and last 4, separated by ellipsis
 * Handles null, undefined, and short strings gracefully
 * 
 * @param addr Address or string to shorten
 * @returns Shortened string or empty string if null/undefined
 */
export const shorten = (addr: string | null | undefined) => {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}; 