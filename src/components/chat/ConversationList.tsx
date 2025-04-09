'use client';

import React from 'react';
import { shorten } from '@/utils/format';
import EmptyState from './EmptyState';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';

interface Conversation {
  id: string;
  partnerAddress: string;
  lastMessage?: string;
  timestamp: string;
  unreadCount?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
  isLoading: boolean;
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  onNewChat,
  isLoading
}: ConversationListProps) {
  const { isVerified, verifyWalletIdentityManually } = useWalletIdentity();

  if (!isVerified) {
    return <EmptyState type="not-verified" onVerify={verifyWalletIdentityManually} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-700 rounded p-3">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-600 rounded w-1/3"></div>
                <div className="h-3 bg-gray-600 rounded w-1/5"></div>
              </div>
              <div className="h-3 bg-gray-600 rounded w-1/2 mt-3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return <EmptyState type="no-conversations" />;
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button
          onClick={onNewChat}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Chat
        </button>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`
              px-3 py-2 rounded-md cursor-pointer transition-colors mb-1
              ${selectedConversationId === conversation.id 
                ? 'bg-blue-700 text-white' 
                : 'hover:bg-gray-700 text-gray-200'}
            `}
            onClick={() => onSelect(conversation)}
          >
            <div className="flex justify-between items-start">
              <div className="font-medium">{shorten(conversation.partnerAddress)}</div>
              <div className="text-xs opacity-80">{formatTime(conversation.timestamp)}</div>
            </div>
            
            <div className="mt-1 text-sm opacity-80 truncate">
              {conversation.lastMessage || 'No messages yet'}
            </div>
            
            {conversation.unreadCount && conversation.unreadCount > 0 && (
              <div className="mt-1 flex justify-end">
                <span className="inline-block px-2 py-1 text-xs font-bold rounded-full bg-blue-500 text-white">
                  {conversation.unreadCount}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 