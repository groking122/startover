'use client';

import React from 'react';
import Link from 'next/link';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import VerifyWalletButton from './VerifyWalletButton';

export default function Header() {
  const { publicAddress, isVerified } = useWalletIdentity();

  return (
    <header className="bg-gradient-to-r from-blue-800 to-purple-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-2xl font-bold">
              Cardano Chat
            </Link>
            <nav className="hidden md:flex space-x-6 ml-10">
              <Link href="/" className="hover:text-blue-200 transition duration-150">
                Home
              </Link>
              <Link href="/conversations" className="hover:text-blue-200 transition duration-150">
                Messages
              </Link>
              <Link href="/about" className="hover:text-blue-200 transition duration-150">
                About
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {publicAddress && (
              <VerifyWalletButton 
                variant="primary" 
                showVerifiedBadge={true}
              />
            )}
            
            {publicAddress && (
              <div className="text-sm bg-blue-900 bg-opacity-50 px-3 py-1 rounded">
                <span className="text-gray-300">Address:</span> 
                <span className="font-mono ml-1">
                  {publicAddress.substring(0, 8)}...{publicAddress.substring(publicAddress.length - 4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Verification banner - only show when wallet is connected but not verified */}
      {publicAddress && !isVerified && (
        <div className="bg-amber-700 py-2 px-4">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between">
            <p className="text-amber-100 mb-2 sm:mb-0">
              <span className="font-semibold">⚠️ Verification Required:</span> Please verify your wallet to enable all features
            </p>
            <VerifyWalletButton variant="secondary" className="bg-amber-800 border-amber-500" />
          </div>
        </div>
      )}
    </header>
  );
} 