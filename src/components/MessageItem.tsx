'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';

interface MessageItemProps {
  message: {
    id: string;
    payment_address_from: string;
    payment_address_to: string;
    message: string;
    timestamp: string;
  };
  isFromMe: boolean;
}

/**
 * Component for displaying a single message in the chat
 */
const MessageItem: React.FC<MessageItemProps> = ({ message, isFromMe }) => {
  // Format the timestamp to "X time ago" format
  const timeAgo = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });
  
  // Truncate long addresses for better display
  const truncateAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.substring(0, 15)}...${address.substring(address.length - 5)}`;
  };
  
  return (
    <div className={`mb-4 p-3 rounded-lg max-w-md ${
      isFromMe 
        ? 'ml-auto bg-blue-600 text-white' 
        : 'mr-auto bg-gray-700 text-white'
    }`}>
      <div className={`text-xs mb-1 ${isFromMe ? 'text-blue-200' : 'text-gray-300'}`}>
        {isFromMe ? 'You' : `From: ${truncateAddress(message.payment_address_from)}`}
        {!isFromMe && (
          <button 
            className="ml-2 text-xs text-blue-400 hover:text-blue-300"
            onClick={() => navigator.clipboard.writeText(message.payment_address_from)}
            title="Copy address"
          >
            📋
          </button>
        )}
      </div>
      
      <div className="text-sm mb-2 break-words">{message.message}</div>
      
      <div className={`text-xs ${isFromMe ? 'text-blue-200' : 'text-gray-300'} mt-1 text-right`}>
        {timeAgo}
      </div>
    </div>
  );
};

export default MessageItem; 