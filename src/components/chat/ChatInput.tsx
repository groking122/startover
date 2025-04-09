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
      // We now expect recipient to be a base address
      const isBase = recipient.startsWith('addr1') || recipient.startsWith('addr_test1');
      
      if (!isBase) {
        toast.error('Recipient must be a base address (starts with addr1...)');
        setLoading(false);
        return;
      }
      
      // Get the sender's base address from the wallet
      let senderBaseAddress = '';
      
      if (enabledWallet && usedAddresses && usedAddresses.length > 0) {
        try {
          // Get wallet API
          const api = await window.cardano[enabledWallet].enable();
          
          // Get base address in hex format
          const usedAddressesHex = await api.getUsedAddresses();
          
          if (usedAddressesHex && usedAddressesHex.length > 0) {
            // Convert first used address from hex to bech32
            const { Address } = await import('@emurgo/cardano-serialization-lib-asmjs');
            senderBaseAddress = Address.from_bytes(Buffer.from(usedAddressesHex[0], 'hex')).to_bech32();
            console.log('Sender base address:', senderBaseAddress);
          } else {
            toast.error('Could not get base address from wallet');
            setLoading(false);
            return;
          }
          
          // Now sign the message with the base address
          const messageToSign = JSON.stringify({
            message,
            timestamp: new Date().toISOString(),
            recipient: recipient
          });
          
          console.log('Signing message:', messageToSign);
          
          // Convert message to hex for signing
          const messageHex = Buffer.from(messageToSign).toString('hex');
          
          // Request signature from wallet using the base address
          const signResult = await api.signData(usedAddressesHex[0], messageHex);
          
          if (!signResult || !signResult.signature || !signResult.key) {
            toast.error('Failed to sign message');
            setLoading(false);
            return;
          }
          
          console.log('Message signed successfully');
          
          // Prepare message data with payment addresses and signature
          const messageData = {
            payment_address_from: senderBaseAddress,
            payment_address_to: recipient,
            message,
            signature: {
              sig: signResult.signature,
              key: signResult.key,
              msg: messageHex
            }
          };

          console.log('Sending message with data:', {
            from: messageData.payment_address_from.substring(0, 15) + '...',
            to: messageData.payment_address_to.substring(0, 15) + '...',
            messageLength: message.length,
            hasSignature: !!messageData.signature
          });
          
          // Send the message to the API
          const response = await fetch('/api/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData),
          });

          let responseData;
          let responseText = '';
          
          try {
            // Try to get the raw text first
            responseText = await response.text();
            console.log('Raw API response text:', responseText);
            
            // Then parse as JSON if possible
            if (responseText && responseText.trim()[0] === '{') {
              responseData = JSON.parse(responseText);
            } else {
              responseData = { error: 'Server returned non-JSON response' };
            }
          } catch (e) {
            console.error('Failed to process response:', e);
            console.error('Raw response text:', responseText.substring(0, 200));
            responseData = { 
              error: 'Could not parse server response',
              rawResponse: responseText.substring(0, 100) + '...'
            };
          }
          
          console.log('API response status:', response.status, 'Response data:', responseData);
          
          if (!response.ok) {
            console.error('Message sending failed with status:', response.status);
            console.error('Error response:', responseData);
            
            // Check if it's an HTML response (server error)
            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
              throw new Error('Server is experiencing issues. Please try again later.');
            }
            
            // Provide more specific error messages based on response status
            if (response.status === 401) {
              throw new Error('Wallet verification required. Please verify your wallet again.');
            } else if (response.status === 429) {
              throw new Error('Sending too fast. Please wait a moment before sending another message.');
            } else if (response.status === 502 || response.status === 503 || response.status === 504) {
              throw new Error('Server is temporarily unavailable. Please try again later.');
            } else {
              throw new Error(responseData.error || 'Failed to send message');
            }
          }

          // Clear the input and show success message
          setMessage('');
          toast.success('Message sent successfully!');
          
          // Call the callback if provided
          if (onMessageSent) {
            onMessageSent();
          }
        } catch (error) {
          console.error('Error sending message:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to send message');
        }
      } else {
        toast.error('Wallet not connected properly');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
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