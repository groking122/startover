'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sendMessage } from '@/utils/client/messageUtils';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { toast } from 'react-hot-toast';
import { safeLocalStorage } from '@/utils/client/browserUtils';

interface MessageComposerProps {
  onMessageSent?: () => void;
}

/**
 * Component for composing and sending messages
 */
const MessageComposer: React.FC<MessageComposerProps> = ({ onMessageSent }) => {
  const [message, setMessage] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { stakeAddress, isVerified } = useWalletIdentity();
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
  
  // Load the payment address from localStorage when component mounts
  useEffect(() => {
    const storedPaymentAddress = safeLocalStorage.getItem('verifiedPaymentAddress');
    if (storedPaymentAddress) {
      setPaymentAddress(storedPaymentAddress);
    }
  }, []);
  
  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    if (!recipientAddress.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }
    
    if (!paymentAddress) {
      toast.error('Your payment address is not available. Please verify your wallet.');
      return;
    }
    
    if (!isVerified) {
      toast.error('Please verify your wallet before sending messages');
      return;
    }
    
    try {
      setIsSending(true);
      
      // Send message using the secure payment address-based approach
      await sendMessage(
        paymentAddress,
        recipientAddress,
        message.trim(),
        stakeAddress || undefined // Optional stake address
      );
      
      // Clear form and notify success
      setMessage('');
      setRecipientAddress('');
      toast.success('Message sent successfully!');
      
      // Notify parent component
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };
  
  if (!isVerified) {
    return (
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="rounded-lg bg-yellow-800 p-3 text-yellow-100 text-center">
          <p>⚠️ Please verify your wallet to send messages</p>
        </div>
      </div>
    );
  }
  
  if (!paymentAddress) {
    return (
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="rounded-lg bg-yellow-800 p-3 text-yellow-100 text-center">
          <p>⚠️ Payment address not available</p>
          <p className="text-sm mt-1">Please reconnect and verify your wallet</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-gray-800 border-t border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-300 mb-1">
            Recipient Payment Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="Enter recipient's payment address..."
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending}
            required
          />
        </div>
        
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
            Message
          </label>
          <textarea
            ref={textareaRef}
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden min-h-[80px]"
            disabled={isSending}
            required
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-400">
            From: {paymentAddress.substring(0, 10)}...
          </div>
          
          <button
            type="submit"
            disabled={isSending || !message.trim() || !recipientAddress.trim()}
            className={`px-4 py-2 rounded-lg font-medium flex items-center ${
              isSending || !message.trim() || !recipientAddress.trim()
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isSending ? (
              <>
                <div className="h-4 w-4 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Message
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageComposer; 