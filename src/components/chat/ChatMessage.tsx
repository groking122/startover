'use client';

import MessageBubble from './MessageBubble';

interface ChatMessageProps {
  content: string;
  timestamp: string;
  isSender: boolean;
  senderName?: string;
  senderAddress?: string;
  walletAddress?: string;
  isVerified?: boolean;
}

export default function ChatMessage({
  content,
  timestamp,
  isSender,
  senderName,
  senderAddress,
  walletAddress,
  isVerified = false
}: ChatMessageProps) {
  // Pass base address information through to the MessageBubble component
  return (
    <MessageBubble 
      message={content}
      timestamp={timestamp}
      isSender={isSender}
      senderName={senderName}
      senderAddress={senderAddress}
      walletAddress={walletAddress}
      isVerified={isVerified}
    />
  );
} 