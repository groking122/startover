// ⚠️ DEPRECATED - LEGACY ENDPOINT ⚠️
// This endpoint is maintained for backward compatibility.
// New implementations should use the main /api/inbox endpoint instead.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utility function to determine if an address is a base address
function isBaseAddress(address: string): boolean {
  return address.startsWith('addr1') || address.startsWith('addr_test1');
}

export async function GET(request: NextRequest) {
  try {
    // Log a warning about using this deprecated endpoint
    console.warn('⚠️ Using deprecated /api/inbox-legacy endpoint');
    
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Check if provided address is a base address
    const isAddressBase = isBaseAddress(address);
    
    // First get all messages where the user is either the sender or recipient (by stake address)
    const { data, error } = await supabase
      .from('messages')
      .select('from, to, to_address')
      .or(`from.eq.${address},to.eq.${address}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inbox:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inbox' },
        { status: 500 }
      );
    }

    // For base addresses, also get messages where to_address matches the base address
    let additionalData: any[] = [];
    if (isAddressBase) {
      const { data: toAddressData, error: toAddressError } = await supabase
        .from('messages')
        .select('from, to, to_address')
        .eq('to_address', address)
        .order('created_at', { ascending: false });
        
      if (!toAddressError && toAddressData) {
        additionalData = toAddressData;
      }
    }
    
    // Combine the results
    const allMessages = [...(data || []), ...additionalData];

    // Extract unique partners from messages
    const partners = new Set<string>();
    allMessages.forEach(message => {
      // If the user is the sender, add the recipient
      if (message.from === address) {
        partners.add(message.to);
        
        // Also add to_address if present
        if (message.to_address) {
          partners.add(message.to_address);
        }
      } 
      // If the user is the recipient or to_address matches base address
      else if (message.to === address || (isAddressBase && message.to_address === address)) {
        partners.add(message.from);
      }
    });

    return NextResponse.json({
      success: true,
      partners: Array.from(partners)
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 