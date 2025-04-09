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
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Check if provided address is a base address
    const isBase = address.startsWith('addr1') || address.startsWith('addr_test1');
    
    // First get all messages where the user is either the sender or recipient (by stake address)
    const { data, error } = await supabase
      .from('messages')
      .select('from, to, to_address')
      .or(`from.eq.${address},to.eq.${address}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // For base addresses, also get messages where to_address matches the base address
    let additionalData: any[] = [];
    if (isBase) {
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

    // Use the shared utility function to extract unique partners
    const partners = resolveInboxPartners(allMessages, address);

    return NextResponse.json({
      success: true,
      partners: partners
    });
  } catch (error) {
    console.error('Error processing inbox request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add POST method with verification checks
export async function POST(req: Request) {
  try {
    // Parse the request body
    const { address } = await req.json();
    
    // Validate inputs
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }
    
    // Ensure the provided address is a base address
    if (!isBaseAddress(address)) {
      return NextResponse.json(
        { error: 'Address must be a valid base address (starts with addr1)' },
        { status: 400 }
      );
    }
    
    // Check if user is verified before proceeding
    const verificationResult = await verifyUserAuthentication(address);
    if (!verificationResult.verified) {
      return NextResponse.json(
        { error: verificationResult.error },
        { status: 401 }
      );
    }
    
    console.log(`Fetching all partners for address: ${address}`);
    
    // Get all messages where the user is either the sender or recipient
    const messagesQuery = await supabase
      .from('messages')
      .select('payment_address_from, payment_address_to, created_at')
      .or(`payment_address_from.eq.${address},payment_address_to.eq.${address}`)
      .order('created_at', { ascending: false });
    
    if (messagesQuery.error) {
      console.error('Error fetching messages:', messagesQuery.error);
      return NextResponse.json(
        { error: 'Failed to fetch messages from database' },
        { status: 500 }
      );
    }
    
    // Extract unique conversation partners from the results
    const partners = new Set<string>();
    
    (messagesQuery.data || []).forEach(msg => {
      if (msg.payment_address_from === address) {
        // This is a message sent by the user, add the recipient
        partners.add(msg.payment_address_to);
      } else {
        // This is a message received by the user, add the sender
        partners.add(msg.payment_address_from);
      }
    });
    
    const partnersArray = Array.from(partners);
    console.log(`Found ${partnersArray.length} unique conversation partners`);
    
    return NextResponse.json({
      success: true,
      partners: partnersArray,
      totalMessages: messagesQuery.data?.length || 0
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