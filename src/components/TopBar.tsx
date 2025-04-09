'use client';

import React, { useState } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import Link from 'next/link';
import WalletComponents from './WalletComponents';
import VerifyWalletButton from './VerifyWalletButton';

interface TopBarProps {
  onRefreshConversations?: () => void;
  onNewConversation?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onRefreshConversations = () => {},
  onNewConversation = () => {},
}) => {
  const { publicAddress, isVerified, isWalletLoading } = useWalletIdentity();

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-white text-xl font-bold">
              Cardano Chat
            </Link>
            
            <div className="hidden md:flex space-x-4 text-gray-300">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <Link href="/about" className="hover:text-white">
                About
              </Link>
            </div>
          </div>
          
          {publicAddress && (
            <>
              <VerifyWalletButton 
                variant="primary" 
                showVerifiedBadge={true} 
              />
            </>
          )}
          
          <WalletComponents 
            onRefreshConversations={onRefreshConversations}
            onNewConversation={onNewConversation}
          />
        </div>
      </div>
      
      {publicAddress && !isVerified && !isWalletLoading && (
        <div className="bg-yellow-800 text-yellow-100 text-sm px-4 py-2">
          ⚠️ Your wallet is connected but not verified.
          <VerifyWalletButton 
            variant="secondary" 
            className="ml-3" 
          />
        </div>
      )}
    </div>
  );
};

export default TopBar; 