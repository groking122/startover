'use client';

import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { shorten } from '@/utils/format';
import { isValidCardanoAddress } from '@/utils/client/stakeUtils';
import { toast } from 'react-hot-toast';
import { resolveInboxPartners } from '@/utils/inboxHelpers';

interface InboxProps {
  stakeAddress: string | null;
  baseAddress?: string | null;
  onSelect: (address: string) => void;
}

// Define the ref type
export interface InboxRefType {
  fetchInbox: (showToast?: boolean) => Promise<void>;
}

// Determine if debug features should be shown
const showDebugFeatures = process.env.NODE_ENV === 'development';

const Inbox = forwardRef<InboxRefType, InboxProps>(({ stakeAddress, baseAddress, onSelect }, ref) => {
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Determine which address to use - prefer baseAddress when available
  const addressToUse = baseAddress || stakeAddress;

  // Function to fetch inbox data
  const fetchInbox = useCallback(async (showToast = false) => {
    console.log('fetchInbox called with showToast:', showToast, 'address:', addressToUse);
    if (!addressToUse) {
      console.error('fetchInbox: No address provided');
      return;
    }
    
    try {
      if (showToast) {
        setRefreshing(true);
        toast.loading('Refreshing conversations...');
      }
      
      const endpoint = `/api/inbox?address=${addressToUse}`;
      console.log('fetchInbox: Fetching from:', endpoint);
      
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error('Failed to fetch inbox');
      }
      
      const json = await res.json();
      console.log('fetchInbox: Response received:', json);
      if (json.success) {
        setPartners(json.partners);
        console.log('fetchInbox: Partners updated:', json.partners);
        if (showToast) {
          toast.dismiss();
          toast.success('Conversations refreshed');
        }
      }
    } catch (error) {
      console.error('Error fetching inbox:', error);
      if (showToast) {
        toast.dismiss();
        toast.error('Failed to refresh inbox');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addressToUse]);

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

  // Manual refresh handler
  const handleRefresh = () => {
    fetchInbox(true); // Show toast notifications
  };

  // Add a more robust method to fetch conversations
  const forceRefreshInbox = async () => {
    if (!addressToUse) {
      toast.error('Connect your wallet first');
      return;
    }
    
    setLoading(true);
    toast.loading('Attempting to force refresh inbox...', { id: 'force-refresh' });
    
    try {
      // Try multiple approaches to fetch conversations
      
      // 1. First try the regular inbox endpoint
      console.log('Trying regular inbox endpoint...');
      try {
        const inboxRes = await fetch(`/api/inbox?address=${addressToUse}`, { 
          cache: 'no-store',
          headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
        });
        
        console.log('Inbox API response status:', inboxRes.status);
        
        if (inboxRes.ok) {
          const inboxText = await inboxRes.text();
          console.log('Inbox API raw response:', inboxText);
          
          try {
            const inboxData = JSON.parse(inboxText);
            if (inboxData.success && inboxData.partners && inboxData.partners.length > 0) {
              setPartners(inboxData.partners);
              toast.dismiss('force-refresh');
              toast.success(`Found ${inboxData.partners.length} conversation partners`, { id: 'force-refresh' });
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse inbox response:', e);
          }
        }
      } catch (inboxError) {
        console.error('Error fetching from inbox endpoint:', inboxError);
      }
      
      // 2. If inbox failed, try messages endpoint directly
      console.log('Trying messages endpoint...');
      try {
        const messagesRes = await fetch(`/api/messages?sender=${addressToUse}`, {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
        });
        
        console.log('Messages API response status:', messagesRes.status);
        
        if (messagesRes.ok) {
          const messagesText = await messagesRes.text();
          console.log('Messages API raw response:', messagesText.substring(0, 200) + '...');
          
          try {
            const messagesData = JSON.parse(messagesText);
            if (messagesData.messages && messagesData.messages.length > 0) {
              // Extract unique partners from messages using utility function
              const partnersList = resolveInboxPartners(messagesData.messages, addressToUse);
              
              setPartners(partnersList);
              toast.dismiss('force-refresh');
              toast.success(`Found ${partnersList.length} conversation partners from messages`, { id: 'force-refresh' });
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse messages response:', e);
            // Set default empty data on parse failure
            const defaultData = { success: false, partners: [] };
            setPartners(defaultData.partners);
          }
        }
      } catch (messagesError) {
        console.error('Error fetching from messages endpoint:', messagesError);
      }
      
      // 3. If all attempts failed, report diagnostic information
      console.error('All attempts to fetch conversations failed');
      toast.dismiss('force-refresh');
      toast.error('Failed to retrieve conversations. See console for details.', { id: 'force-refresh' });
      
      // Show detailed diagnostic information in the browser console
      console.log('Diagnostic Information:');
      console.log('Address:', addressToUse);
      console.log('Current Partners State:', partners);
      console.log('User Agent:', navigator.userAgent);
      console.log('Current Time:', new Date().toISOString());
      
    } catch (error) {
      console.error('Global error in force refresh:', error);
      toast.dismiss('force-refresh');
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'force-refresh' });
    } finally {
      setLoading(false);
    }
  };

  // Determine if an address is a base address
  const isBaseAddress = (address: string) => {
    return address.startsWith('addr1') || address.startsWith('addr_test1');
  };

  if (loading) {
    return <div className="text-gray-400">Loading inbox...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold">Inbox</h2>
        <div className="flex justify-end mb-4 space-x-2">
          {/* Only show force refresh button in development */}
          {showDebugFeatures && (
            <button
              className="flex items-center text-sm px-3 py-1 bg-red-700 text-red-100 rounded hover:bg-red-600 transition"
              onClick={forceRefreshInbox}
              disabled={refreshing || loading}
            >
              <svg className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
              Force Refresh
            </button>
          )}
          
          <button
            className="flex items-center text-sm px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Display diagnostic information when no partners are found */}
      {partners.length === 0 && !loading && (
        <div className="text-gray-400 text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
          <p>No conversations found</p>
          <p className="text-sm mt-2 text-gray-500">
            Try using the "Force Refresh" button above
          </p>
          <div className="mt-4 text-xs text-left bg-gray-800 p-2 rounded">
            <p>Wallet Address: {addressToUse ? `${addressToUse.substring(0, 10)}...${addressToUse.substring(addressToUse.length - 6)}` : 'Not connected'}</p>
          </div>
        </div>
      )}
      
      {/* Partner list display remains the same */}
      {partners.length > 0 && (
        <div className="space-y-3">
          {partners.map((partner) => {
            const isBase = isBaseAddress(partner);
            return (
              <button
                key={partner}
                className="block w-full text-left bg-gray-800 p-3 rounded hover:bg-gray-700 transition"
                onClick={() => onSelect(partner)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div>{shorten(partner)}</div>
                    {isBase && (
                      <div className="text-xs text-gray-400">Base Address</div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// Add display name for better debugging
Inbox.displayName = 'Inbox';

export default Inbox; 