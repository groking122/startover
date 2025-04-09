'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { shorten } from '@/utils/format';
import { toast } from 'react-hot-toast';
import EmptyState from './EmptyState';
import { getMessages, markAsRead } from '@/utils/messageApi';

interface Message {
  id: string;
  from_address: string;
  to_address: string;
  message: string;
  is_read: boolean;
  created_at: string;
  signature?: string;
  public_key?: string;
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
  const { stakeAddress, isVerified } = useWalletIdentity();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [recipientWalletAddress, setRecipientWalletAddress] = useState<string | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState(false);

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
      // Use our messageApi utility to fetch messages
      const result = await getMessages(recipientAddress);
      const newMessages = result.messages || [];
      
      // Prevent unnecessary updates by checking if the messages have changed
      if (messageCache[recipientAddress] && 
          JSON.stringify(messageCache[recipientAddress]) === JSON.stringify(newMessages)) {
        return;
      }
      
      // Update messages state and cache
      setMessages(newMessages);
      setMessageCache(prev => ({ ...prev, [recipientAddress]: newMessages }));
      
      // Try to mark all unread messages in this conversation as read
      await markMessagesAsRead(recipientAddress);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [stakeAddress, recipientAddress, messageCache]);

  // Function to mark all messages from a partner as read
  const markMessagesAsRead = async (partnerId: string) => {
    // Skip if already marking as read or not authenticated
    if (markingAsRead || !stakeAddress || !isVerified) return;
    
    // Find unread messages from this partner
    const unreadMessages = messages.filter(msg => 
      msg.from_address === partnerId && 
      msg.to_address === stakeAddress && 
      !msg.is_read
    );
    
    // Skip if no unread messages
    if (unreadMessages.length === 0) return;
    
    setMarkingAsRead(true);
    
    try {
      // Use our messageApi utility to mark messages as read
      const result = await markAsRead({
        partnerId: partnerId
      });
      
      console.log(`Marked ${result.updatedCount} messages as read`);
      
      // Update the local message cache by marking messages as read
      if (result.updatedCount > 0) {
        const updatedMessages = messages.map(msg => {
          if (msg.from_address === partnerId && msg.to_address === stakeAddress && !msg.is_read) {
            return { ...msg, is_read: true };
          }
          return msg;
        });
        
        // Update state and cache
        setMessages(updatedMessages);
        setMessageCache(prev => ({ ...prev, [recipientAddress]: updatedMessages }));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  };

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
      
      // If we have cached messages and the recipient changes, mark messages as read
      markMessagesAsRead(recipientAddress);
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
    return message.from_address === stakeAddress;
  }, [stakeAddress]);

  // Handle new message sent
  const handleMessageSent = useCallback(() => {
    // Refresh messages after sending
    fetchMessages();
  }, [fetchMessages]);

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
              onClick={fetchMessages}
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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState type="no-messages" />
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.message}
                timestamp={message.created_at}
                isSender={isFromCurrentUser(message)}
                senderName={isFromCurrentUser(message) ? "You" : shorten(message.from_address)}
                senderAddress={message.from_address}
                walletAddress={message.to_address}
                isVerified={true} // Could be extended to check verification status
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <ChatInput 
        recipient={recipientAddress} 
        onMessageSent={handleMessageSent}
      />
    </div>
  );
} 