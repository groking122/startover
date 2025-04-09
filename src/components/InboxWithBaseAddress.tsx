'use client';

import { useState, useEffect } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';

interface Partner {
  address: string;
  // Add other fields as needed
}

export default function InboxWithBaseAddress() {
  const { baseAddress, isVerified } = useWalletIdentity();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Function to fetch inbox data
    const fetchInbox = async () => {
      if (!baseAddress) {
        setPartners([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/inbox?address=${baseAddress}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch inbox: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Inbox data:', data);
        
        if (data.success && data.partners) {
          // Map the array of addresses to an array of partner objects
          const partnersList = data.partners.map((address: string) => ({
            address,
            // Add other properties as needed
          }));
          
          setPartners(partnersList);
        } else {
          setPartners([]);
          if (data.error) {
            setError(data.error);
          }
        }
      } catch (err) {
        console.error('Inbox fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch inbox');
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch inbox when baseAddress changes or is available
    if (baseAddress) {
      fetchInbox();
    }
  }, [baseAddress]);
  
  if (!baseAddress) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Connect your wallet to see your inbox</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse">Loading inbox...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
        <button 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Your Conversations</h2>
      
      {partners.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No conversations yet</p>
      ) : (
        <ul className="space-y-2">
          {partners.map((partner, index) => (
            <li key={index} className="p-3 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
              <div className="flex items-center">
                <div className="truncate font-mono">{partner.address.substring(0, 10)}...{partner.address.substring(partner.address.length - 6)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 