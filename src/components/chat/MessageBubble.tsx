'use client';

import React from 'react';
import { shorten } from '@/utils/format';

interface MessageBubbleProps {
  message: string;
  timestamp: string;
  isSender: boolean;
  senderName?: string;
  senderAddress?: string;
  walletAddress?: string;
  isVerified?: boolean;
}

const formatTime = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function MessageBubble({
  message,
  timestamp,
  isSender,
  senderName,
  senderAddress,
  walletAddress,
  isVerified = false
}: MessageBubbleProps) {
  // Determine address type for display purposes
  const isBaseAddress = senderAddress?.startsWith('addr1') || senderAddress?.startsWith('addr_test1');
  const addressType = isBaseAddress ? 'Base Address' : 'Stake Address';
  
  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`
        max-w-[70%] rounded-lg px-4 py-2 text-sm break-words
        ${isSender ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}
      `}>
        {!isSender && (
          <div className="text-xs font-medium text-gray-500 mb-1">
            <div className="flex items-center gap-1">
              <span>{senderName || (senderAddress ? shorten(senderAddress) : "Unknown")}</span>
              {isBaseAddress && senderAddress && (
                <span className="text-xs ml-1 text-gray-400">(Base Address)</span>
              )}
              {isVerified && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Verified
                </span>
              )}
            </div>
            {walletAddress && (
              <div className="text-xs text-gray-400">
                {isBaseAddress ? "Sent from:" : "Wallet:"} {shorten(walletAddress)}
              </div>
            )}
          </div>
        )}
        <p>{message}</p>
        <div className="text-xs text-gray-400 mt-1 text-right flex justify-end items-center">
          {formatTime(timestamp)}
          {isSender ? (
            <span className="ml-1">
              {' • You '}
              {isVerified && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-700 text-white ml-1">
                  ✓ Verified
                </span>
              )}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
} 