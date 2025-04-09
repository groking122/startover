'use client';

import React from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';

interface VerifyWalletButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'small';
  showVerifiedBadge?: boolean;
}

export default function VerifyWalletButton({
  className = '',
  variant = 'primary',
  showVerifiedBadge = false
}: VerifyWalletButtonProps) {
  const { isVerified, isWalletLoading, verifyWalletIdentityManually, publicAddress } = useWalletIdentity();

  // If no wallet is connected, don't show the button
  if (!publicAddress) {
    return null;
  }

  // Define styles based on variant
  let buttonStyle = '';
  
  switch (variant) {
    case 'primary':
      buttonStyle = isVerified 
        ? 'px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors'
        : 'px-4 py-2 bg-amber-600 text-white font-semibold rounded-md hover:bg-amber-700 transition-colors';
      break;
    case 'secondary':
      buttonStyle = isVerified
        ? 'px-4 py-2 border border-green-600 text-green-600 font-semibold rounded-md hover:bg-green-50 transition-colors'
        : 'px-4 py-2 border border-amber-600 text-amber-600 font-semibold rounded-md hover:bg-amber-50 transition-colors';
      break;
    case 'small':
      buttonStyle = isVerified
        ? 'px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors'
        : 'px-2 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors';
      break;
  }

  return (
    <div className="flex items-center">
      <button
        onClick={verifyWalletIdentityManually}
        disabled={isWalletLoading}
        className={`${buttonStyle} ${isWalletLoading ? 'opacity-75 cursor-wait' : ''} ${className}`}
      >
        {isWalletLoading ? (
          <div className="flex items-center">
            <div className="h-4 w-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
            <span>Verifying...</span>
          </div>
        ) : (
          <div className="flex items-center">
            {!isVerified && (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            <span>{isVerified ? 'Re-verify Wallet' : 'Verify Wallet'}</span>
          </div>
        )}
      </button>
      
      {showVerifiedBadge && isVerified && !isWalletLoading && (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          ✅ Verified
        </span>
      )}
    </div>
  );
} 