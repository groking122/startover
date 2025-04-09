/**
 * Browser-specific utilities that safely handle window/document APIs
 * to avoid SSR issues and Next.js build errors
 */

/**
 * Safely access localStorage with error handling and SSR compatibility
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Error setting localStorage:', error);
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }
};

/**
 * Check if code is running in browser environment
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Safely access window.cardano with SSR compatibility
 */
export const getCardanoWallets = () => {
  if (!isBrowser) return null;
  return window.cardano;
};

/**
 * Safely handle browser clipboard API
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!isBrowser) return false;
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

/**
 * Delay execution - useful for various browser operations
 */
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms)); 