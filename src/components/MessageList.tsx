'use client';

import React, { useState, useEffect } from 'react';
import MessageItem from './MessageItem';
import { fetchMessages } from '@/utils/client/messageUtils';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';

/**
 * Component for displaying a list of messages
 */
const MessageList: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get the current wallet's payment address from localStorage or context
  const { stakeAddress, isVerified } = useWalletIdentity();
  const [paymentAddress, setPaymentAddress] = useState<string | null>(null);
  
  // Load the payment address from localStorage when component mounts
  useEffect(() => {
    const storedPaymentAddress = localStorage.getItem('verifiedPaymentAddress');
    if (storedPaymentAddress) {
      setPaymentAddress(storedPaymentAddress);
    }
  }, []);
  
  // Fetch messages when payment address is available
  useEffect(() => {
    if (!paymentAddress || !isVerified) return;
    
    const loadMessages = async () => {
      try {
        setLoading(true);
        const fetchedMessages = await fetchMessages(paymentAddress);
        setMessages(fetchedMessages);
        setError(null);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
    
    // Set up polling every 30 seconds to fetch new messages
    const intervalId = setInterval(loadMessages, 30000);
    
    return () => clearInterval(intervalId);
  }, [paymentAddress, isVerified]);
  
  if (!isVerified) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-400 mb-2">⚠️ Please verify your wallet to view messages</p>
        <p className="text-gray-400 text-sm">Verification is required for message security</p>
      </div>
    );
  }
  
  if (!paymentAddress) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-400">⚠️ Payment address not found</p>
        <p className="text-gray-400 text-sm mt-2">Please reconnect and verify your wallet</p>
      </div>
    );
  }
  
  if (loading && messages.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-2 text-gray-400">Loading messages...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button 
          onClick={() => fetchMessages(paymentAddress)}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  if (messages.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">No messages found</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 flex flex-col space-y-4">
      {messages.map(message => (
        <MessageItem
          key={message.id}
          message={message}
          isFromMe={message.payment_address_from === paymentAddress}
        />
      ))}
    </div>
  );
};

export default MessageList; 