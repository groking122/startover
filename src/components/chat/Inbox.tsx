'use client';

import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { shorten } from '@/utils/format';
import { isValidCardanoAddress } from '@/utils/client/stakeUtils';
import { toast } from 'react-hot-toast';
import ConversationList from './ConversationList';
import { useWalletIdentity } from '@/providers/WalletIdentityProvider';

// Define the types for conversation data
export interface Conversation {
  id: string;
  partnerAddress: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

interface InboxProps {
  onSelect: (address: string) => void;
}

// Define the ref type
export interface InboxRefType {
  fetchInbox: (showToast?: boolean) => Promise<void>;
}

// Determine if debug features should be shown
const showDebugFeatures = process.env.NODE_ENV === 'development';

const Inbox = forwardRef<InboxRefType, InboxProps>(({ onSelect }, ref) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { primaryAddress, stakeAddress, isVerified } = useWalletIdentity();

  // Function to handle selecting a conversation
  const handleSelectConversation = (conversation: { id: string; partnerAddress: string }) => {
    setSelectedConversationId(conversation.id);
    onSelect(conversation.partnerAddress);
  };

  // Function to handle starting a new chat
  const handleNewChat = () => {
    toast.success('Enter a wallet address to start a new conversation');
  };

  // Function to fetch inbox data
  const fetchInbox = useCallback(async (showToast = false) => {
    // Use primary address first, fall back to stake address
    const userAddress = primaryAddress || stakeAddress;
    
    console.log('fetchInbox called with showToast:', showToast, 'userAddress:', userAddress);
    if (!userAddress) {
      console.error('fetchInbox: No wallet address provided');
      return;
    }
    
    setLoading(true);
    
    try {
      if (showToast) {
        setRefreshing(true);
        toast.loading('Refreshing conversations...');
      }
      
      // Use our new conversations API endpoint
      const res = await fetch(`/api/conversations`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch conversations');
      }
      
      const data = await res.json();
      console.log('fetchInbox: Response received:', data);
      
      if (data.success) {
        // Map the API response to our conversation format
        const mappedConversations = data.conversations.map((conv: any, index: number) => ({
          id: `conv-${index}`,
          partnerAddress: conv.partner_address,
          lastMessage: conv.last_message || '',
          timestamp: conv.last_timestamp,
          unreadCount: conv.unread_count || 0
        }));
        
        setConversations(mappedConversations);
        console.log('fetchInbox: Conversations updated:', mappedConversations);
        
        if (showToast) {
          toast.dismiss();
          toast.success('Conversations refreshed');
        }
      }
    } catch (error) {
      console.error('Error fetching inbox:', error);
      if (showToast) {
        toast.dismiss();
        toast.error('Failed to refresh conversations');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [primaryAddress, stakeAddress]);

  // Expose the fetchInbox method to parent components via ref
  useImperativeHandle(ref, () => {
    console.log('Creating inbox ref with fetchInbox method');
    return {
      fetchInbox: (showToast = false) => {
        console.log('fetchInbox called through ref with showToast:', showToast);
        return fetchInbox(showToast);
      }
    };
  }, [fetchInbox]);

  // Initial fetch and polling
  useEffect(() => {
    fetchInbox(); // initial fetch without toast

    const interval = setInterval(() => fetchInbox(), 10000); // poll every 10s

    return () => clearInterval(interval); // cleanup on unmount
  }, [fetchInbox]);

  return (
    <ConversationList
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      onSelect={handleSelectConversation}
      onNewChat={handleNewChat}
      isLoading={loading}
    />
  );
});

// Add display name for better debugging
Inbox.displayName = 'Inbox';

export default Inbox; 