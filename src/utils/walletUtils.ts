import type { Cip30Wallet } from '@cardano-sdk/cip30';

/**
 * Detects all available Cardano wallets that implement the CIP-30 interface
 * Explicitly checks for Vespr wallet even if it doesn't follow the standard apiVersion structure
 */
export const getAvailableWallets = (): string[] => {
  if (typeof window === 'undefined' || !window.cardano) {
    return [];
  }

  return Object.keys(window.cardano).filter(
    key => (key === "vespr" || window.cardano[key]?.apiVersion) && window.cardano[key]?.enable
  );
};

/**
 * Gets the user-friendly name of a wallet
 */
export const getWalletName = (walletKey: string): string => {
  if (typeof window === 'undefined' || !window.cardano?.[walletKey]) {
    return walletKey;
  }

  if (walletKey === "vespr") {
    return window.cardano.vespr.name || "Vespr";
  }

  return window.cardano[walletKey].name || walletKey;
};

/**
 * Enables a specific wallet and returns its API
 */
export const enableWallet = async (walletKey: string): Promise<any> => {
  if (typeof window === 'undefined' || !window.cardano?.[walletKey]?.enable) {
    throw new Error(`Wallet ${walletKey} not available`);
  }

  try {
    return await window.cardano[walletKey].enable();
  } catch (error) {
    console.error(`Error enabling ${walletKey} wallet:`, error);
    throw error;
  }
};

/**
 * Checks if a wallet is currently enabled
 */
export const isWalletEnabled = async (walletKey: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.cardano?.[walletKey]?.isEnabled) {
    return false;
  }

  try {
    return await window.cardano[walletKey].isEnabled();
  } catch (error) {
    console.error(`Error checking if ${walletKey} is enabled:`, error);
    return false;
  }
};

/**
 * Configures Lucid with the selected wallet
 */
export const configureLucidWithWallet = async (walletKey: string) => {
  try {
    const api = await enableWallet(walletKey);
    
    // Dynamically import Lucid to avoid top-level await during SSR
    const { getLucidInstance } = await import('../lib/lucidSetup');
    const lucid = await getLucidInstance(api as unknown as Cip30Wallet);
    
    return { api, lucid };
  } catch (error) {
    console.error(`Error configuring Lucid with ${walletKey}:`, error);
    throw error;
  }
};

/**
 * Creates a wallet picker component configuration
 * Can be used to generate a wallet list with names and icons
 */
export const getWalletPickerConfig = () => {
  const wallets = getAvailableWallets();
  
  return wallets.map(key => ({
    id: key,
    name: getWalletName(key),
    icon: window.cardano?.[key]?.icon || '',
    isVespr: key === "vespr"
  }));
}; 