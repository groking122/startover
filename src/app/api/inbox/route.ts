import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveInboxPartners } from '@/utils/inboxHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utility function to determine if an address is a base address
function isBaseAddress(address: string): boolean {
  return address.startsWith('addr1') || address.startsWith('addr_test1');
}

// New implementation using the resolveInboxPartners utility function
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  
  if (!address) {
    return NextResponse.json(
      { error: 'Address parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    // Determine if the provided address is a base address
    const isBase = isBaseAddress(address);
    
    // Set up the query based on address type
    let query;
    if (isBase) {
      query = supabase
        .from('messages')
        .select('*')
        .or(`payment_address_from.eq.${address},payment_address_to.eq.${address},stake_address_to.eq.${address}`);
    } else {
      query = supabase
        .from('messages')
        .select('*')
        .or(`payment_address_from.eq.${address},payment_address_to.eq.${address}`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }
    
    // Extract unique conversation partners
    const partners = resolveInboxPartners(data || [], address);
    
    return NextResponse.json({
      success: true,
      partners
    });
  } catch (error) {
    console.error('Error processing inbox request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add POST method for compatibility with all-partners endpoint
export async function POST(req: Request) {
  try {
    // Parse the request body
    const { stakeAddress } = await req.json();
    
    // Validate inputs
    if (!stakeAddress) {
      return NextResponse.json(
        { error: 'Stake address is required' },
        { status: 400 }
      );
    }
    
    // Check if provided address is a base address
    const isBase = stakeAddress.startsWith('addr1') || stakeAddress.startsWith('addr_test1');
    
    console.log(`Fetching all partners for address: ${stakeAddress} (Base address: ${isBase})`);
    
    // First get all messages where the user is either the sender or recipient
    const messagesQuery = await supabase
      .from('messages')
      .select('from, to, to_address, created_at')
      .or(`from.eq.${stakeAddress},to.eq.${stakeAddress}`)
      .order('created_at', { ascending: false });
    
    if (messagesQuery.error) {
      console.error('Error fetching messages:', messagesQuery.error);
      return NextResponse.json(
        { error: 'Failed to fetch messages from database' },
        { status: 500 }
      );
    }
    
    // For base addresses, also get messages where to_address matches
    let additionalMessages: any[] = [];
    if (isBase) {
      const additionalQuery = await supabase
        .from('messages')
        .select('from, to, to_address, created_at')
        .eq('to_address', stakeAddress)
        .order('created_at', { ascending: false });
        
      if (!additionalQuery.error && additionalQuery.data) {
        additionalMessages = additionalQuery.data;
      }
    }
    
    // Combine all messages
    const allMessages = [...(messagesQuery.data || []), ...additionalMessages];
    
    console.log(`Found ${allMessages.length} total messages`);
    
    // Use the utility function to extract unique partners
    const partnersArray = resolveInboxPartners(allMessages, stakeAddress);
    console.log(`Found ${partnersArray.length} unique conversation partners`);
    
    return NextResponse.json({
      success: true,
      partners: partnersArray,
      totalMessages: allMessages.length
    });
    
  } catch (error) {
    console.error('Error processing direct fetch request:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 