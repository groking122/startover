'use client';

import React from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';

export default function VerifyWalletBanner() {
  const { stakeAddress, isVerified, verifyWalletIdentityManually, isWalletLoading } = useWalletIdentity();

  // Only show the banner if wallet is connected but not verified
  if (!stakeAddress || isVerified) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white py-3 px-4">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between">
        <div className="flex items-center mb-3 sm:mb-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-lg">Wallet Connected, Verification Required</h3>
            <p className="text-sm text-white text-opacity-90">
              Your wallet is connected but needs verification to send and receive messages
            </p>
          </div>
        </div>
        <button
          onClick={verifyWalletIdentityManually}
          disabled={isWalletLoading}
          className="px-4 py-2 bg-white text-amber-600 font-semibold rounded-md hover:bg-gray-100 transition-colors disabled:opacity-75 disabled:cursor-wait"
        >
          {isWalletLoading ? (
            <div className="flex items-center">
              <div className="h-4 w-4 border-t-2 border-amber-600 rounded-full animate-spin mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <span>Verify Wallet Now</span>
          )}
        </button>
      </div>
    </div>
  );
} 