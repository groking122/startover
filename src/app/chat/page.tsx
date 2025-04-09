'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';

// Add Next.js special exports for page config
export const config = {
  runtime: 'edge',
  unstable_runtimeJS: true
};

// Dynamically import components that rely on browser APIs with explicit ssr: false
const DynamicTopBar = dynamic(() => import('@/components/TopBar'), { ssr: false });
const DynamicMessageList = dynamic(() => import('@/components/MessageList'), { ssr: false });
const DynamicMessageComposer = dynamic(() => import('@/components/MessageComposer'), { ssr: false });

/**
 * Chat page that combines message listing and composition
 * Uses payment addresses for secure messaging
 */
export default function ChatPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isClient, setIsClient] = useState(false);
  
  // Safety check to confirm we're running in the browser
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Trigger message list refresh when a new message is sent
  const handleMessageSent = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Show a loading state until we confirm we're on the client
  if (!isClient) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white items-center justify-center">
        <div className="h-8 w-8 border-t-2 border-blue-500 border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-400">Loading chat application...</p>
      </div>
    );
  }
  
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
      
      <DynamicTopBar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="py-2 px-4 border-b border-gray-700 bg-gray-800">
          <h1 className="text-xl font-bold">Secure Messages</h1>
          <p className="text-sm text-gray-400">
            Messages are securely verified using Cardano payment addresses
          </p>
        </div>
        
        {/* Message list with auto-scroll to bottom */}
        <div className="flex-1 overflow-y-auto" key={refreshTrigger}>
          <DynamicMessageList />
        </div>
        
        {/* Message composer */}
        <DynamicMessageComposer onMessageSent={handleMessageSent} />
      </div>
    </main>
  );
} 