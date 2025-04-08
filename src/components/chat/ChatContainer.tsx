'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { shorten } from '@/utils/format';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  from: string;
  to: string;
  to_address?: string;
  message: string;
  created_at: string;
}

interface ChatContainerProps {
  recipientAddress: string;
  recipientName?: string;
}

// Determine if debug features should be shown
const showDebugFeatures = process.env.NODE_ENV === 'development';

export default function ChatContainer({ recipientAddress, recipientName }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageCache, setMessageCache] = useState<Record<string, Message[]>>({});
  const { stakeAddress } = useWalletIdentity();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [recipientWalletAddress, setRecipientWalletAddress] = useState<string | null>(null);

  // Function to fetch messages - wrapped in useCallback to prevent recreation on every render
  const fetchMessages = useCallback(async () => {
    if (!stakeAddress || !recipientAddress) return;
    
    // Check if we have cached messages for this recipient
    if (messageCache[recipientAddress]) {
      setMessages(messageCache[recipientAddress]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    
    try {
      // Include the address type in the request for proper handling
      const isBaseAddress = recipientAddress.startsWith('addr1') || recipientAddress.startsWith('addr_test1');
      
      const response = await fetch(
        `/api/messages?sender=${stakeAddress}&recipient=${recipientAddress}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      const newMessages = data.messages || [];
      
      // Prevent unnecessary updates by checking if the messages have changed
      if (messageCache[recipientAddress] && 
          JSON.stringify(messageCache[recipientAddress]) === JSON.stringify(newMessages)) {
        return;
      }
      
      // Update messages state and cache
      setMessages(newMessages);
      setMessageCache(prev => ({ ...prev, [recipientAddress]: newMessages }));
      
      // Look for recipient's wallet address in the messages
      const receivedMessages = newMessages.filter((msg: Message) => {
        if (isBaseAddress) {
          // If recipient is a base address, use direct equality
          return msg.from === recipientAddress || msg.to_address === recipientAddress;
        } else {
          // For stake addresses, compare against the 'from' field
          return msg.from === recipientAddress;
        }
      });
      
      const walletAddressMsg = receivedMessages.find((msg: Message) => msg.to_address);
      if (walletAddressMsg && walletAddressMsg.to_address) {
        setRecipientWalletAddress(walletAddressMsg.to_address);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [stakeAddress, recipientAddress, messageCache]);

  // Debounced fetch function for chat switching
  const debouncedFetch = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      fetchMessages();
    }, 300);
  }, [fetchMessages]);

  // Set initial messages from cache when recipient changes
  useEffect(() => {
    if (stakeAddress && recipientAddress && messageCache[recipientAddress]) {
      setMessages(messageCache[recipientAddress]);
      setLoading(false);
    }
  }, [recipientAddress, messageCache, stakeAddress]);

  // Fetch messages when component mounts or recipient changes
  useEffect(() => {
    if (!stakeAddress || !recipientAddress) return;

    // Use debounced fetch for initial load to prevent rapid switching issues
    debouncedFetch();

    const interval = setInterval(() => {
      fetchMessages();
    }, 10000); // every 10s

    return () => {
      clearInterval(interval); // cleanup interval
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current); // cleanup debounce
      }
    };
  }, [stakeAddress, recipientAddress, debouncedFetch, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to determine if a message is from the current user
  const isFromCurrentUser = useCallback((message: Message) => {
    return message.from === stakeAddress;
  }, [stakeAddress]);

  // Add a method to directly fetch messages for debugging
  const forceLoadMessages = async () => {
    if (!stakeAddress || !recipientAddress) {
      toast.error('Both sender and recipient addresses must be available');
      return;
    }
    
    setLoading(true);
    toast.loading('Attempting to force load messages...', { id: 'force-load' });
    
    try {
      console.log(`Directly fetching messages between ${stakeAddress} and ${recipientAddress}`);
      
      // Try to fetch messages with less restrictive parameters
      const response = await fetch(
        `/api/messages?sender=${stakeAddress}&recipient=${recipientAddress}`,
        {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
        }
      );
      
      console.log('Messages API status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        toast.dismiss('force-load');
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      
      // Get the raw response text first
      const responseText = await response.text();
      console.log('Raw API response:', responseText.substring(0, 200) + '...');
      
      // Try to parse the response
      try {
        const data = JSON.parse(responseText);
        const newMessages = data.messages || [];
        
        console.log(`Found ${newMessages.length} messages`);
        
        if (newMessages.length > 0) {
          setMessages(newMessages);
          setMessageCache(prev => ({ ...prev, [recipientAddress]: newMessages }));
          toast.dismiss('force-load');
          toast.success(`Loaded ${newMessages.length} messages`, { id: 'force-load' });
        } else {
          toast.dismiss('force-load');
          toast.success('No messages found in this conversation', { id: 'force-load' });
        }
      } catch (parseError) {
        console.error('Failed to parse API response:', parseError);
        toast.dismiss('force-load');
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error force loading messages:', error);
      toast.dismiss('force-load');
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'force-load' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-700 p-3 border-b border-gray-600 flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-gray-600 w-8 h-8 rounded-full flex items-center justify-center mr-2">
            {recipientAddress.startsWith('addr1') ? 'A' : 'S'}
          </div>
          <div>
            <div className="font-medium">
              {recipientName || shorten(recipientAddress)}
            </div>
            <div className="text-xs text-gray-400">
              {recipientAddress}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* Only show Force Load button in development */}
          {showDebugFeatures && (
            <button
              onClick={forceLoadMessages}
              className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-2 py-1 rounded"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Force Load Messages'}
            </button>
          )}
          <button
            onClick={fetchMessages}
            className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            <p className="mb-2">No messages yet</p>
            <p className="text-sm text-gray-500">Start the conversation by sending a message below</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatMessage 
                key={msg.id || index}
                content={msg.message}
                timestamp={msg.created_at}
                isSender={msg.from === stakeAddress}
                senderName={msg.from === stakeAddress ? undefined : recipientName}
                senderAddress={msg.from === stakeAddress ? undefined : msg.from}
                walletAddress={msg.from !== stakeAddress && msg.to_address ? msg.to_address : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <ChatInput
        recipient={recipientAddress}
        onMessageSent={fetchMessages}
      />
    </div>
  );
} 