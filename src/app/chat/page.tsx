'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import TopBar from '@/components/TopBar';

// Use dynamic imports to avoid hydration errors with components that rely on browser APIs
const MessageList = dynamic(() => import('@/components/MessageList'), { ssr: false });
const MessageComposer = dynamic(() => import('@/components/MessageComposer'), { ssr: false });

/**
 * Chat page that combines message listing and composition
 * Uses payment addresses for secure messaging
 */
export default function ChatPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Trigger message list refresh when a new message is sent
  const handleMessageSent = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  return (
    <main className="flex flex-col h-screen bg-gray-900 text-white">
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
        }}
      />
      
      <TopBar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="py-2 px-4 border-b border-gray-700 bg-gray-800">
          <h1 className="text-xl font-bold">Secure Messages</h1>
          <p className="text-sm text-gray-400">
            Messages are securely verified using Cardano payment addresses
          </p>
        </div>
        
        {/* Message list with auto-scroll to bottom */}
        <div className="flex-1 overflow-y-auto" key={refreshTrigger}>
          <MessageList />
        </div>
        
        {/* Message composer */}
        <MessageComposer onMessageSent={handleMessageSent} />
      </div>
    </main>
  );
} 