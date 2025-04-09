'use client';

import { useState, useEffect } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { getSessionRemainingMs, refreshSession } from '@/utils/sessionManager';
import { toast } from 'react-hot-toast';

interface SessionStatusProps {
  showDetails?: boolean;
  onExpired?: () => void;
}

export default function SessionStatus({ showDetails = false, onExpired }: SessionStatusProps) {
  const { isVerified, verifyWalletIdentityManually } = useWalletIdentity();
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch and update the remaining session time
  const updateRemainingTime = async () => {
    const remaining = await getSessionRemainingMs();
    setRemainingTime(remaining);
    
    // If session is expired and callback is provided, call it
    if (remaining <= 0 && onExpired) {
      onExpired();
    }
  };

  // Set up interval to update remaining time every minute
  useEffect(() => {
    if (!isVerified) {
      setRemainingTime(null);
      return;
    }
    
    // Initial update
    updateRemainingTime();
    
    // Update every minute
    const interval = setInterval(updateRemainingTime, 60000);
    
    return () => clearInterval(interval);
  }, [isVerified, onExpired]);

  // Handle session refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        toast.success('Session refreshed successfully');
        updateRemainingTime();
      } else {
        toast.error('Failed to refresh session');
        
        // If refresh fails, try to re-verify
        if (verifyWalletIdentityManually) {
          const shouldReVerify = window.confirm('Your session needs re-verification. Verify now?');
          if (shouldReVerify) {
            verifyWalletIdentityManually();
          }
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      toast.error('Error refreshing session');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format remaining time in minutes
  const formatRemainingTime = () => {
    if (!remainingTime) return '--';
    
    const minutes = Math.floor(remainingTime / 60000);
    if (minutes <= 0) return 'Expired';
    
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  };

  // Status class based on remaining time
  const getStatusClass = () => {
    if (!remainingTime) return 'bg-gray-300';
    
    if (remainingTime <= 300000) { // Less than 5 minutes
      return 'bg-red-500 animate-pulse';
    } else if (remainingTime <= 600000) { // Less than 10 minutes
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  };

  // Don't render anything if user is not verified
  if (!isVerified) {
    return null;
  }

  // Simple status indicator when not showing details
  if (!showDetails) {
    return (
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${getStatusClass()}`} />
        {remainingTime && remainingTime <= 600000 && (
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  // Detailed status display
  return (
    <div className="bg-white rounded-md shadow p-3 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusClass()}`} />
          <span className="text-sm font-medium">Session</span>
        </div>
        <span className="text-sm">{formatRemainingTime()}</span>
      </div>
      
      {remainingTime && remainingTime <= 1800000 && ( // Show refresh button with 30 min or less remaining
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="mt-2 w-full text-center py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
        </button>
      )}
    </div>
  );
} 