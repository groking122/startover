'use client';

import { useState, useEffect } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { getSessionRemainingMs } from '@/utils/sessionManager';

interface SessionExpiredModalProps {
  checkInterval?: number; // in milliseconds
  onReVerified?: () => void;
}

export default function SessionExpiredModal({ 
  checkInterval = 60000, // Check every minute 
  onReVerified 
}: SessionExpiredModalProps) {
  const { isVerified, verifyWalletIdentityManually } = useWalletIdentity();
  const [showModal, setShowModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Check if session has expired
  const checkSession = async () => {
    if (!isVerified) return;
    
    const remaining = await getSessionRemainingMs();
    if (remaining <= 0) {
      setShowModal(true);
    }
  };

  // Set up interval to check session expiry
  useEffect(() => {
    checkSession();
    
    const interval = setInterval(checkSession, checkInterval);
    
    return () => clearInterval(interval);
  }, [isVerified, checkInterval]);

  // Reset modal when user is successfully verified
  useEffect(() => {
    if (isVerified && showModal) {
      setShowModal(false);
      if (onReVerified) {
        onReVerified();
      }
    }
  }, [isVerified, showModal, onReVerified]);

  // Handle re-verification
  const handleReVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyWalletIdentityManually();
    } catch (error) {
      console.error('Re-verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Don't render anything if modal shouldn't be shown
  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Session Expired</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Your wallet verification session has expired. For security reasons, you need to re-verify your wallet to continue using the application.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleReVerify}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Re-verify Wallet'}
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 