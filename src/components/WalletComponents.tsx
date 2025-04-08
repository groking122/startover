'use client';

import React, { useState, useEffect } from 'react';
import { useCardano } from '@cardano-foundation/cardano-connect-with-wallet';
import { ConnectWalletList } from '@cardano-foundation/cardano-connect-with-wallet';
import toast, { Toaster } from 'react-hot-toast';
// Import the utility functions for ADA/lovelace conversion, but defer the Lucid initialization
import { adaToLovelace } from '../lib/lucidSetup';
// Import the client-only stake conversion utility
import { convertStakeAddressHexToBech32, getStakeAddress } from '../utils/client/stakeUtils';
// Import wallet identity context
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
// Import wallet type
import type { Cip30Wallet } from '@cardano-sdk/cip30';
// Import wallet utilities
import { getAvailableWallets, getWalletName, enableWallet } from '@/utils/walletUtils';
// Import our custom wallet picker
import CustomWalletPicker from './CustomWalletPicker';

// Update the dynamically imported getLucidInstance to handle import errors
const getLucidInstance = async (walletApi: Cip30Wallet) => {
  // Dynamically import the module only when needed (client-side) with error handling
  try {
    if (typeof window === 'undefined') {
      console.warn('Attempted to initialize Lucid on server');
      return null;
    }
    
    const lucidSetupModule = await import('../lib/lucidSetup').catch(err => {
      console.error('Failed to import lucid setup:', err);
      return null;
    });
    
    if (!lucidSetupModule) {
      console.error('Lucid setup module could not be loaded');
      return null;
    }
    
    return lucidSetupModule.getLucidInstance(walletApi);
  } catch (error) {
    console.error('Error getting Lucid instance:', error);
    return null;
  }
};

interface WalletComponentsProps {
  onRefreshConversations?: () => void;
  onNewConversation?: () => void;
}

// Message signing modal
const SignMessageModal = ({ onSign, onCancel }: { onSign: (message: string) => void, onCancel: () => void }) => {
  const [message, setMessage] = useState('');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Sign Message</h3>
        <p className="text-sm mb-4 text-gray-600">Sign a message with your wallet to authenticate.</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message to sign..."
          className="w-full border rounded p-2 mb-4 h-32"
        />
        <div className="flex space-x-3">
          <button 
            onClick={() => onSign(message)}
            disabled={!message.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            Sign Message
          </button>
          <button 
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Send token modal
const SendTokenModal = ({ onSend, onCancel }: { onSend: (address: string, amount: number) => void, onCancel: () => void }) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isConfirmationShown, setIsConfirmationShown] = useState(false);
  const [addressError, setAddressError] = useState('');
  
  const validateCardanoAddress = (address: string) => {
    // Basic validation - address should start with addr1
    if (!address.startsWith('addr1')) {
      setAddressError('Address should start with addr1');
      return false;
    }
    
    // Check minimum length (rough estimate)
    if (address.length < 50) {
      setAddressError('Address seems too short');
      return false;
    }
    
    // Clear errors if valid
    setAddressError('');
    return true;
  };
  
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value;
    setRecipient(address);
    
    // Only validate if there's some input
    if (address.length > 5) {
      validateCardanoAddress(address);
    } else {
      setAddressError('');
    }
  };
  
  const handleSubmit = () => {
    if (recipient && amount && validateCardanoAddress(recipient)) {
      if (!isConfirmationShown) {
        // Show confirmation step first
        setIsConfirmationShown(true);
        return;
      }
      
      // If confirmation is shown and user clicks again, proceed with sending
      const adaAmount = parseFloat(amount);
      onSend(recipient, adaAmount);
    } else if (!validateCardanoAddress(recipient)) {
      toast.error('Invalid Cardano address');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">
          {isConfirmationShown ? 'Confirm Transaction' : 'Send ADA'}
        </h3>
        
        {isConfirmationShown ? (
          <>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-4">
              <h4 className="font-medium text-yellow-800 mb-2">⚠️ Important: This is a real transaction</h4>
              <p className="text-sm text-yellow-700">
                You are about to send <span className="font-bold">{amount} ADA</span> to:
              </p>
              <p className="text-xs font-mono bg-gray-100 p-2 mt-1 break-all rounded">
                {recipient}
              </p>
              <p className="text-sm mt-2 text-yellow-700">
                This action cannot be undone. Are you sure you want to proceed?
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Confirm & Send ADA
              </button>
              <button 
                onClick={() => setIsConfirmationShown(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Go Back
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={handleAddressChange}
                placeholder="addr1..."
                className={`w-full border rounded p-2 ${addressError ? 'border-red-500' : ''}`}
              />
              {addressError && (
                <p className="text-sm text-red-500 mt-1">{addressError}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Enter a valid Cardano address to send ADA to
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Amount (ADA)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="1"
                step="0.1"
                className="w-full border rounded p-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum recommended amount: 1 ADA
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button 
                onClick={handleSubmit}
                disabled={!recipient || !amount || !!addressError}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                Review Transaction
              </button>
              <button 
                onClick={onCancel}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const WalletComponents: React.FC<WalletComponentsProps> = ({
  onRefreshConversations = () => {},
  onNewConversation = () => {}
}) => {
  // Wallet connection state
  const [showWalletList, setShowWalletList] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTxSuccessModal, setShowTxSuccessModal] = useState(false);
  const [signedMessage, setSignedMessage] = useState<{message: string, signature: string, key?: string} | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<{txHash: string, status: 'pending' | 'confirmed' | 'failed'} | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkId, setNetworkId] = useState<number | null>(null);
  
  // Use the cardano hook - safe to use here since this component is only loaded client-side
  const {
    isConnected,
    enabledWallet,
    connect,
    disconnect,
    signMessage,
    accountBalance,
    usedAddresses,
  } = useCardano();
  
  // Get the stakeAddress from the WalletIdentity context
  const { stakeAddress, isVerified } = useWalletIdentity();

  // Check for wallet extensions on component mount
  useEffect(() => {
    const checkWalletExtensions = () => {
      // Check if window.cardano exists and has wallet extensions
      if (typeof window !== 'undefined' && window.cardano) {
        const availableWallets = getAvailableWallets();
        
        // Log available wallets for debugging
        console.log("Available wallets detected:", availableWallets);
        
        if (availableWallets.length === 0) {
          toast.error('No Cardano wallet extensions detected. Please install one to continue.', {
            duration: 5000,
          });
        } else if (availableWallets.includes("vespr")) {
          console.log("✅ Vespr wallet is available");
          toast.success("Vespr wallet detected!", {
            icon: '🎉',
            duration: 3000,
          });
        }
      }
    };
    
    // Check for wallets after a short delay to let the page load fully
    setTimeout(checkWalletExtensions, 1000);
  }, []);

  // Check network ID when wallet is connected
  useEffect(() => {
    const checkNetworkId = async () => {
      if (isConnected && enabledWallet && typeof window !== 'undefined' && window.cardano && window.cardano[enabledWallet]) {
        try {
          const api = await enableWallet(enabledWallet);
          if (api.getNetworkId) {
            const id = await api.getNetworkId();
            setNetworkId(id);
            
            // Check if the wallet is on mainnet (id = 1) or testnet (id = 0)
            const expectedNetwork = 1; // Change to 0 for testnet
            
            if (id !== expectedNetwork) {
              toast.error(`Please switch your wallet to ${expectedNetwork === 1 ? 'mainnet' : 'testnet'}`, {
                duration: 5000,
              });
            }
          }
        } catch (err) {
          console.error('Error checking network ID:', err);
        }
      }
    };
    
    if (isConnected) {
      checkNetworkId();
    }
  }, [isConnected, enabledWallet]);

  // Function to handle wallet connection
  const handleConnectWallet = async (walletId: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      setIsConnecting(true);
      await connect(walletId);
      setShowWalletList(false); // Hide wallet list after connection
      
      toast.success(`Connected to ${getWalletName(walletId)}!`, {
        duration: 3000,
      });
      
      console.log('Calling onRefreshConversations after wallet connection');
      
      // Add a delay before refreshing conversations to allow components to mount
      setTimeout(() => {
        onRefreshConversations();
      }, 1500);
      
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast.error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        duration: 5000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignMessage = (message: string) => {
    setShowSignModal(false);
    
    if (!isConnected || !enabledWallet) {
      toast.error('Please connect your wallet first', { duration: 3000 });
      return;
    }
    
    (async () => {
      try {
        const api = await enableWallet(enabledWallet);
        const lucid = await getLucidInstance(api as unknown as Cip30Wallet);
        
        if (!lucid) {
          toast.error('Failed to initialize wallet provider', { duration: 3000 });
          return;
        }
        
        toast.loading('Signing message...', { id: 'signing' });
        
        signMessage(
          message, 
          // Success callback
          (signature: string, key: string | undefined) => {
            console.log(`Message successfully signed with signature: ${signature}`);
            toast.success('Message signed successfully', { id: 'signing' });
            setSignedMessage({
              message,
              signature,
              key
            });
          },
          // Error callback
          (error: unknown) => {
            console.error('Error signing message:', error);
            toast.error(`Failed to sign message: ${error instanceof Error ? error.message : String(error)}`, { id: 'signing' });
          }
        );
      } catch (error) {
        console.error('Error signing message:', error);
        toast.error(`Failed to sign message: ${error instanceof Error ? error.message : String(error)}`, { id: 'signing' });
      }
    })();
  };

  const handleSendTransaction = async (recipientAddress: string, amount: number) => {
    setShowSendModal(false);
    
    if (!isConnected || !enabledWallet) {
      toast.error('Please connect your wallet first', { duration: 3000 });
      return;
    }
    
    try {
      setTransactionStatus({
        txHash: "",
        status: 'pending'
      });
      
      // Convert ADA to lovelace
      const lovelaceAmount = adaToLovelace(amount);
      
      // Get the wallet API and create Lucid instance
      const api = await enableWallet(enabledWallet);
      const lucid = await getLucidInstance(api as unknown as Cip30Wallet);
      
      if (!lucid) {
        toast.error('Failed to initialize wallet provider', { duration: 3000 });
        setTransactionStatus(null);
        return;
      }
      
      toast.loading('Building transaction...', { id: 'transaction' });
      
      // 4. Build the transaction
      const tx = await lucid
        .newTx()
        .payToAddress(recipientAddress, { lovelace: lovelaceAmount })
        .complete();
      
      toast.loading('Signing transaction...', { id: 'transaction' });
      
      // 5. Sign the transaction
      const signedTx = await tx.sign().complete();
      
      toast.loading('Submitting transaction...', { id: 'transaction' });
      
      // 6. Submit the transaction to the blockchain
      const txHash = await signedTx.submit();
      
      // 7. Update UI state with the transaction hash
      setTransactionStatus({
        txHash,
        status: 'pending'
      });
      
      toast.loading(`Transaction submitted. Waiting for confirmation...`, { id: 'transaction' });
      
      // 8. Wait for transaction confirmation using Lucid's built-in method
      toast.loading('Waiting for blockchain confirmation (this may take a few minutes)...', { id: 'transaction' });
      
      // Use Lucid's awaitTx method to wait for confirmation
      await lucid.awaitTx(txHash);
      
      // Update transaction status once confirmed
      setTransactionStatus(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'confirmed'
        };
      });
      
      toast.success('Transaction confirmed! View details on CardanoScan.', { id: 'transaction' });
      
      // Record transaction in backend
      try {
        // First, check if stakeAddress is available
        if (!stakeAddress) {
          toast.error("Stake address not available");
          console.error('Transaction not recorded in backend: Stake address is not available');
          return;
        }
        
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            from: stakeAddress,
            to: recipientAddress,
            amount
          }),
        });
        console.log('Transaction recorded in backend');
      } catch (error) {
        console.error('Failed to record transaction in backend:', error);
      }
      
      // Show success modal with CardanoScan link
      setShowTxSuccessModal(true);
      
      // Auto-close the modal after 15 seconds
      setTimeout(() => {
        setShowTxSuccessModal(false);
      }, 15000);

      setTimeout(() => {
        setTransactionStatus(null);
      }, 15500);
      
    } catch (error: unknown) {
      console.error('Transaction error:', error);
      
      let errorMessage = 'Failed to send ADA';
      
      // Extract meaningful error messages
      if (typeof error === 'object' && error !== null) {
        if ('info' in error && error.info) {
          errorMessage = String(error.info);
        } else if ('message' in error && error.message) {
          errorMessage = String(error.message);
        }
      }
      
      // Handle specific error cases
      if (errorMessage.includes('INPUTS_DEPLETED')) {
        errorMessage = 'Not enough ADA in your wallet to complete this transaction';
      } else if (errorMessage.includes('UTXO_NOT_FOUND')) {
        errorMessage = 'Wallet state has changed. Please reload and try again';
      } else if (errorMessage.includes('DENIED_BY_USER')) {
        errorMessage = 'Transaction rejected by user';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Transaction confirmation timed out. Check CardanoScan for status.';
      }
      
      toast.error(errorMessage, { id: 'transaction' });
      
      setTransactionStatus(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'failed'
        };
      });
    }
  };

  // Format the address for display (truncate middle)
  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    // For stake addresses, keep the prefix
    if (addr.startsWith('stake1')) {
      return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
    }
    // For other addresses (like payment addresses)
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
  };

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
            },
          },
          duration: 5000,
        }}
      />
      
      <div className="p-4 bg-gray-800 text-white flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {!isConnected ? (
            <button
              onClick={() => setShowWalletList(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="h-4 w-4 border-t-2 border-white rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 2v1h12V6H4zm0 4a1 1 0 00-1 1v5a1 1 0 001-1v-5a1 1 0 00-1-1H4z" clipRule="evenodd" />
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center">
              {networkId !== null && (
                <div className={`p-1 px-2 text-xs rounded mr-2 ${networkId === 1 ? 'bg-pink-700 text-pink-100' : 'bg-green-700 text-green-100'}`}>
                  {networkId === 1 ? 'Mainnet' : 'Testnet'}
                </div>
              )}
              
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 2v1h12V6H4zm0 4a1 1 0 00-1 1v5a1 1 0 001-1v-5a1 1 0 00-1-1H4z" clipRule="evenodd" />
                </svg>
                {enabledWallet ? getWalletName(enabledWallet) : "Wallet"}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showActionMenu && (
                <div className="absolute top-16 right-4 mt-2 w-56 bg-white rounded-md shadow-lg z-50">
                  <div className="py-1 text-gray-800 divide-y divide-gray-100">
                    <div className="text-xs text-gray-500 px-4 py-2">
                      Connected as
                      <div className="font-mono mt-1 text-black">
                        {stakeAddress ? (
                          <>
                            {stakeAddress.substring(0, 10)}
                            <span className="text-gray-400">...</span>
                            {stakeAddress.substring(stakeAddress.length - 6)}
                          </>
                        ) : (
                          'Loading address...'
                        )}
                      </div>
                    </div>
                    
                    {/* Wallet actions section */}
                    <div>
                      <button
                        className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setShowActionMenu(false);
                          console.log('Refresh button clicked in menu, calling onRefreshConversations');
                          onRefreshConversations(); // Call the refresh function from props
                        }}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Refresh Conversations
                      </button>
                      <button
                        className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowSignModal(true);
                        }}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Sign Message
                      </button>
                      <button
                        className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowSendModal(true);
                        }}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send ADA
                      </button>
                      <button
                        className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        onClick={() => {
                          setShowActionMenu(false);
                          disconnect(); // Use the disconnect function from useCardano
                        }}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Disconnect Wallet
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <button 
            onClick={onNewConversation}
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            disabled={!isConnected}
          >
            New Conversation
          </button>
        </div>
        
        <div className="text-sm">
          {isConnected ? (
            <div className="flex flex-col items-end">
              <div className="flex items-center">
                <span className="font-medium mr-2">Balance:</span>
                <span className="font-mono">{accountBalance?.toFixed(6) || '0.000000'} ₳</span>
              </div>
              <div className="mt-1">
                <span className="mr-1">Connected to {enabledWallet}</span>
                <span className="font-mono">({formatAddress(stakeAddress)})</span>
                {isVerified && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    ✅ Verified
                  </span>
                )}
              </div>
              
              {usedAddresses && usedAddresses.length > 0 && (
                <div className="mt-1 text-xs">
                  <span className="font-medium">Address:</span>
                  <span className="ml-1 font-mono">{formatAddress(usedAddresses[0])}</span>
                </div>
              )}
              
              {signedMessage && (
                <div className="mt-1 text-xs bg-green-800 p-1 rounded">
                  <span className="font-medium">Message signed:</span>
                  <span className="ml-1">{signedMessage.message.substring(0, 15)}...</span>
                </div>
              )}
              
              {transactionStatus && (
                <div className="flex flex-col">
                  <div className={`mt-1 text-xs p-1 rounded ${
                    transactionStatus.status === 'pending' ? 'bg-yellow-800' : 
                    transactionStatus.status === 'confirmed' ? 'bg-green-800' : 'bg-red-800'
                  }`}>
                    <span className="font-medium">Transaction {transactionStatus.status}:</span>
                    <span className="ml-1 font-mono">{transactionStatus.txHash.substring(0, 10)}...</span>
                  </div>
                  <a 
                    href={`https://cardanoscan.io/transaction/${transactionStatus.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 ml-1 transition-colors"
                  >
                    View on CardanoScan
                  </a>
                </div>
              )}
            </div>
          ) : (
            <span>Status: Not Connected</span>
          )}
        </div>
      </div>
      
      {/* Wallet selection modal */}
      {showWalletList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <CustomWalletPicker 
            onConnect={handleConnectWallet}
            onCancel={() => setShowWalletList(false)}
          />
        </div>
      )}
      
      {/* Sign message modal */}
      {showSignModal && (
        <SignMessageModal 
          onSign={handleSignMessage}
          onCancel={() => setShowSignModal(false)}
        />
      )}
      
      {/* Send token modal */}
      {showSendModal && (
        <SendTokenModal 
          onSend={handleSendTransaction}
          onCancel={() => {
            setShowSendModal(false);
            // No need to reset transaction status here since it stays the same
          }}
        />
      )}
      
      {/* Transaction Success Modal */}
      {showTxSuccessModal && transactionStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            
            <h3 className="text-xl font-bold mb-2 text-center">Transaction Confirmed!</h3>
            
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <p className="text-sm mb-2">Transaction Hash:</p>
              <p className="font-mono text-xs break-all">{transactionStatus.txHash}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transactionStatus.txHash);
                  toast.success("TX hash copied to clipboard");
                }}
                className="mt-1 text-xs text-blue-500 underline hover:text-blue-400 transition-colors"
              >
                Copy TX Hash
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 text-center">
              Your transaction has been confirmed on the Cardano blockchain.
            </p>
            
            <div className="flex flex-col space-y-3">
              <a 
                href={`https://cardanoscan.io/transaction/${transactionStatus.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded text-center hover:bg-blue-700 transition-colors"
              >
                View on CardanoScan
              </a>
              <button 
                onClick={() => {
                  setShowTxSuccessModal(false);
                  // Don't immediately clear transaction status so user can still see it in the UI
                  // But schedule a cleanup after a delay
                  setTimeout(() => setTransactionStatus(null), 500);
                }}
                className="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletComponents; 