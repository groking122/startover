'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import SessionStatus from './session/SessionStatus';

// Lazily load the wallet components with no SSR to avoid "window is not defined" errors
const WalletComponents = dynamic(
  () => import('./WalletComponents'),
  { ssr: false }
);

interface TopBarProps {
  onRefreshConversations?: () => void;
  onNewConversation?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onRefreshConversations = () => {},
  onNewConversation = () => {}
}) => {
  const { stakeAddress, isVerified, verifyWalletIdentityManually, isWalletLoading } = useWalletIdentity();
  
  console.log('TopBar received onRefreshConversations:', !!onRefreshConversations);
  
  const handleRefresh = () => {
    console.log('TopBar refresh button clicked, calling onRefreshConversations');
    onRefreshConversations();
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      {/* Debug information - can be removed in production */}
      {process.env.NODE_ENV === 'development' && (
        <>
          <div className="text-xs text-gray-400 p-1 bg-gray-800 border-b border-gray-700">
            stake: {stakeAddress ? stakeAddress.slice(0, 10) + '...' : 'null'} | verified: {isVerified ? '✅' : '❌'} | loading: {isWalletLoading ? '⏳' : '✓'}
          </div>
          
          <pre className="text-xs text-red-500 bg-black p-1 rounded">
            {JSON.stringify({ stakeAddress, isVerified, isWalletLoading }, null, 2)}
          </pre>
        </>
      )}
      
      <div className="p-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Cardano Chat</h1>
        
        <div className="flex space-x-2 items-center">
          {/* Session status indicator */}
          {isVerified && (
            <div className="mr-3 flex items-center">
              <span className="text-xs text-gray-400 mr-2">Session:</span>
              <SessionStatus />
            </div>
          )}
          
          {stakeAddress && (
            <>
              {isVerified && (
                <button
                  className="px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition flex items-center text-sm"
                  onClick={handleRefresh}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Refresh
                </button>
              )}
              
              <button
                className={`px-3 py-1 rounded transition flex items-center text-sm ${
                  isVerified ? 'bg-green-700 text-white hover:bg-green-600' : 'bg-yellow-600 text-white hover:bg-yellow-500'
                }`}
                onClick={verifyWalletIdentityManually}
                disabled={isWalletLoading}
              >
                {isWalletLoading ? (
                  <div className="h-4 w-4 border-t-2 border-white rounded-full animate-spin mr-1" />
                ) : (
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {isVerified ? 'Re-verify Wallet' : 'Verify Wallet'}
              </button>
            </>
          )}
          
          <WalletComponents 
            onRefreshConversations={onRefreshConversations}
            onNewConversation={onNewConversation}
          />
        </div>
      </div>
      
      {stakeAddress && !isVerified && !isWalletLoading && (
        <div className="bg-yellow-800 text-yellow-100 text-sm px-4 py-2">
          ⚠️ Your wallet is connected but not verified.
          <button
            className="ml-3 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={verifyWalletIdentityManually}
          >
            Verify Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default TopBar; 