'use client';

import { useState } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { toast } from 'react-hot-toast';
import { useCardano } from '@cardano-foundation/cardano-connect-with-wallet';
import { 
  isValidCardanoAddress, 
  resolveToStakeAddress,
  convertStakeAddressHexToBech32
} from '@/utils/client/stakeUtils';
import { sendMessage } from '@/utils/messageApi';
import { MessageApiError } from '@/types/messages';

interface ChatInputProps {
  recipient: string;
  onMessageSent?: () => void;
}

export default function ChatInput({ recipient, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { stakeAddress, isVerified, usedAddresses, verifyWalletIdentityManually } = useWalletIdentity();
  const { enabledWallet } = useCardano();

  const handleSend = async () => {
    console.log('Send button clicked', { stakeAddress, isVerified, recipientValid: isValidCardanoAddress(recipient) });
    
    if (!message.trim() || !stakeAddress) {
      toast.error('Please connect your wallet and enter a message');
      return;
    }

    if (!isVerified) {
      toast.error('Please verify your wallet first');
      return;
    }

    // Validate recipient address
    if (!isValidCardanoAddress(recipient)) {
      toast.error('Invalid recipient address');
      return;
    }

    setLoading(true);
    
    try {
      // Determine if recipient is a base address
      const isBase = recipient.startsWith('addr1') || recipient.startsWith('addr_test1');
      
      // For base addresses, resolve to stake address for proper routing
      let toStake: string | null = null;
      
      // If wallet is already connected, we can use that to directly get the stake address
      if (enabledWallet) {
        try {
          // Try to get the wallet API
          const api = await window.cardano[enabledWallet].enable();
          
          // Get the currently enabled wallet's reward addresses
          const rewardAddrs = await api.getRewardAddresses();
          
          if (rewardAddrs && rewardAddrs.length > 0) {
            // Convert the first reward address to bech32 format
            const walletStakeAddr = await convertStakeAddressHexToBech32(rewardAddrs[0]);
            
            // Check if the recipient is one of our addresses
            if (walletStakeAddr && (recipient === walletStakeAddr || recipient === stakeAddress)) {
              console.log('Recipient is the current wallet, using wallet stake address');
              toStake = walletStakeAddr;
            }
          }
        } catch (walletError) {
          console.warn('Could not access wallet API:', walletError);
        }
      }
      
      // If we couldn't get the stake address from the wallet, resolve from the base address
      if (!toStake) {
        toStake = isBase ? await resolveToStakeAddress(recipient) : recipient;
      }
      
      // If we couldn't resolve the stake address, use the original recipient
      if (!toStake && isBase) {
        console.warn('Could not resolve base address to stake address, using original address');
        // Don't use the base address as fallback for 'to' field - this would cause routing issues
        // Instead, just log the error and reject the send
        toast.error('Could not determine the recipient\'s stake address. Message cannot be sent.');
        setLoading(false);
        return;
      }
      
      // IMPORTANT: Ensure the recipient address is a stake address if it was resolved
      // If the recipient was already a stake address, this check is redundant
      if (toStake && !toStake.startsWith('stake1') && !toStake.startsWith('stake_test1')) {
        console.error('Resolution failed to produce a valid stake address:', toStake);
        toast.error('Failed to determine a valid stake address for the recipient');
        setLoading(false);
        return;
      }
      
      // Log full addresses - don't truncate when logging addresses for debugging
      console.log('Address resolution:', { 
        original: recipient,
        isBase,
        resolved: toStake,
        sender: stakeAddress
      });
      
      // Send message using the messageApi utility
      const response = await sendMessage({
        to: toStake!,
        message: message
      });
      
      console.log('Message sent successfully:', response);
      
      // Clear the input and show success message
      setMessage('');
      toast.success('Message sent successfully!');
      
      // Call the callback if provided
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Handle specific API errors
      if ((error as MessageApiError).error) {
        const apiError = error as MessageApiError;
        
        // Check for rate limiting
        if (apiError.retryAfter) {
          const retryDate = new Date(apiError.retryAfter);
          const waitTime = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
          
          toast.error(`Rate limit exceeded. Please try again in ${waitTime} seconds.`);
        } else {
          toast.error(apiError.error);
        }
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to send message');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Show re-verify button when needed */}
      {stakeAddress && !isVerified && (
        <div className="bg-yellow-900 bg-opacity-40 p-2 rounded mb-2 flex items-center justify-between">
          <span className="text-yellow-200 text-sm">Wallet needs verification to send messages</span>
          <button
            onClick={verifyWalletIdentityManually}
            className="px-2 py-1 bg-yellow-700 text-yellow-100 text-xs rounded hover:bg-yellow-600 transition-colors"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* Server error message if we got an HTML response */}
      {stakeAddress && isVerified && (
        <div className="text-right mb-1">
          <button
            onClick={verifyWalletIdentityManually}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Re-verify wallet
          </button>
        </div>
      )}

      <div className="flex items-center">
        <input
          type="text"
          placeholder={isVerified ? "Type a message..." : "Verify wallet to send messages..."}
          className="flex-1 bg-gray-700 text-white rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading || !stakeAddress}
        />
        <button
          className="bg-blue-600 text-white rounded-r-md px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          onClick={handleSend}
          disabled={loading || !message.trim() || !stakeAddress || !isVerified}
        >
          {loading ? (
            <div className="h-5 w-5 border-t-2 border-white rounded-full animate-spin" />
          ) : (
            <span>Send</span>
          )}
        </button>
      </div>
    </div>
  );
} 