'use client';

import React from 'react';

interface EmptyStateProps {
  type: 'no-messages' | 'no-conversations' | 'not-verified';
  onVerify?: () => void;
}

export default function EmptyState({ type, onVerify }: EmptyStateProps) {
  switch (type) {
    case 'no-messages':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No messages yet</h3>
          <p className="text-gray-400 max-w-md">
            Start the conversation by sending a message using the input box below.
          </p>
        </div>
      );
      
    case 'no-conversations':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No conversations yet</h3>
          <p className="text-gray-400 max-w-md mb-4">
            Click "Start New Chat" to begin messaging with any Cardano wallet address.
          </p>
        </div>
      );
      
    case 'not-verified':
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-16 h-16 bg-amber-600 bg-opacity-30 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Wallet Verification Required</h3>
          <p className="text-gray-400 max-w-md mb-4">
            You need to verify your wallet before you can send or receive messages.
            Verification helps prevent impersonation and ensures message security.
          </p>
          {onVerify && (
            <button
              onClick={onVerify}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
            >
              Verify Wallet Now
            </button>
          )}
        </div>
      );
      
    default:
      return null;
  }
} 