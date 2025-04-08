'use client';

import { useCardano } from '@cardano-foundation/cardano-connect-with-wallet';

/**
 * Custom hook that provides wallet identity information
 * 
 * This hook wraps the useCardano hook from cardano-connect-with-wallet
 * and provides a focused subset of wallet identity properties
 * 
 * @returns Object containing wallet identity information
 */
export const useWalletIdentity = () => {
  const {
    isConnected,
    enabledWallet,
    stakeAddress,
    usedAddresses,
    accountBalance
  } = useCardano();

  return {
    isConnected,
    enabledWallet,
    stakeAddress,
    usedAddresses,
    accountBalance
  };
}; 