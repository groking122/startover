'use client';

import { useState, useCallback, useRef } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import TopBar from '@/components/TopBar';
import ChatContainer from '@/components/chat/ChatContainer';
import Inbox from '@/components/chat/Inbox';
import { toast } from 'react-hot-toast';
import { isValidCardanoAddress } from '@/utils/client/stakeUtils';
import ApiStatusChecker from './ApiStatusChecker';

export default function HomeClient() {
  const [recipient, setRecipient] = useState<string>('');
  const [mode, setMode] = useState<'inbox' | 'manual'>('inbox');
  const { stakeAddress, baseAddress, isVerified } = useWalletIdentity();
  const inboxRef = useRef<{ fetchInbox: (showToast?: boolean) => Promise<void> }>(null);
  
  // Function to handle starting a new chat
  const handleStartChat = (address: string) => {
    if (!address) {
      toast.error('Please enter a recipient address');
      return;
    }
    
    // Validate that the address is a valid Cardano address
    if (!isValidCardanoAddress(address)) {
      toast.error('Invalid Cardano address format');
      return;
    }
    
    setRecipient(address);
  };
  
  // Function to refresh conversations
  const handleRefreshConversations = useCallback(() => {
    console.log('handleRefreshConversations called, inboxRef:', inboxRef.current);
    
    // Use baseAddress if available, fall back to stakeAddress
    const addressToUse = baseAddress || stakeAddress;
    
    // Check if address is available
    if (!addressToUse) {
      console.log('Cannot refresh conversations: No wallet connected');
      return;
    }
    
    if (inboxRef.current) {
      inboxRef.current.fetchInbox(true);
    } else {
      // Check if we're in a state where the inbox should be available
      if (mode === 'inbox' && recipient === '') {
        console.error('inboxRef is not set when trying to refresh conversations');
        
        // Retry with a small delay if we're in inbox mode but the ref isn't ready
        setTimeout(() => {
          console.log('Retrying refresh after delay...');
          if (inboxRef.current) {
            inboxRef.current.fetchInbox(true);
            console.log('Refresh successful on retry');
          } else {
            console.error('inboxRef still not available after retry');
            toast.error('Unable to refresh conversations');
          }
        }, 1000);
      } else {
        // We're not in inbox mode, so this is expected
        console.log('Inbox component not mounted, cannot refresh');
      }
    }
  }, [baseAddress, stakeAddress, mode, recipient]);

  // Use baseAddress if available, otherwise fall back to stakeAddress for rendering decisions
  const walletConnected = baseAddress || stakeAddress;

  return (
    <main className="flex flex-col h-screen bg-gray-900 text-white">
      <TopBar onRefreshConversations={handleRefreshConversations} />
      
      <div className="flex-1 container mx-auto p-4 flex flex-col">
        {!walletConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold mb-4">Connect your wallet</h1>
          </div>
        ) : !isVerified ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold mb-3">Wallet Verification Required</h2>
            <p className="text-gray-300 text-center max-w-md mb-4">
              Please verify your wallet by signing a message using the button in the banner above.
              Verification is needed to send and receive messages securely.
            </p>
          </div>
        ) : !recipient ? (
          mode === 'inbox' ? (
            <div className="flex-1 p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Inbox</h2>
                <button
                  onClick={() => setMode('manual')}
                  className="text-sm text-blue-400 hover:underline"
                >
                  + Start New Chat
                </button>
              </div>
              <Inbox
                ref={inboxRef}
                stakeAddress={stakeAddress}
                baseAddress={baseAddress}
                onSelect={(partner) => {
                  setRecipient(partner);
                  console.log('Partner selected:', partner);
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-full max-w-md">
                <div className="flex mb-6">
                  <input 
                    type="text" 
                    placeholder="Enter recipient base address (starts with addr1)"
                    className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-l p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <button 
                    className="bg-blue-600 text-white rounded-r px-4 py-2 hover:bg-blue-700"
                    onClick={() => recipient && setRecipient(recipient)}
                  >
                    Chat
                  </button>
                </div>
                <button
                  onClick={() => setMode('inbox')}
                  className="text-sm text-gray-400 hover:underline"
                >
                  ← Back to Inbox
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="mb-4 flex justify-between">
              <button 
                className="text-blue-400 hover:text-blue-300"
                onClick={() => setRecipient('')}
              >
                ← Back to Inbox
              </button>
            </div>
            <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
              <ChatContainer 
                recipientAddress={recipient} 
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Add API status checker for development environment */}
      {process.env.NODE_ENV === 'development' && <ApiStatusChecker />}
    </main>
  );
} 