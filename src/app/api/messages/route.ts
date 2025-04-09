export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Message {
  id: string;
  payment_address_from: string;
  payment_address_to: string;
  stake_address_to?: string;
  message: string;
  created_at: string;
}

// Utility to determine if an address is a base address
function isBaseAddress(address: string): boolean {
  return address.startsWith('addr1') || address.startsWith('addr_test1');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sender = searchParams.get('sender');
    const recipient = searchParams.get('recipient');

    if (!sender || !recipient) {
      return NextResponse.json(
        { error: 'Sender and recipient parameters are required' },
        { status: 400 }
      );
    }

    // Check if recipient is a base address
    const isRecipientBaseAddress = isBaseAddress(recipient);
    
    // Construct a more flexible query to handle both stake and base addresses
    let query;
    
    if (isRecipientBaseAddress) {
      // If recipient is a base address, look for messages where stake_address_to matches
      query = supabase
        .from('messages')
        .select('*')
        .or(`and(payment_address_from.eq.${sender},stake_address_to.eq.${recipient}),and(payment_address_from.eq.${recipient},payment_address_to.eq.${sender})`);
    } else {
      // For stake addresses, search in both directions using the payment_address_to field
      query = supabase
        .from('messages')
        .select('*')
        .or(`and(payment_address_from.eq.${sender},payment_address_to.eq.${recipient}),and(payment_address_from.eq.${recipient},payment_address_to.eq.${sender})`);
    }
    
    // Execute the query with proper ordering
    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }
    
    // For base addresses, we need an additional query to find messages to that address
    let additionalData: any[] = [];
    if (isRecipientBaseAddress) {
      // Also search for messages explicitly to this base address
      const { data: additionalMessages, error: additionalError } = await supabase
        .from('messages')
        .select('*')
        .eq('stake_address_to', recipient)
        .order('created_at', { ascending: true });
        
      if (!additionalError && additionalMessages) {
        additionalData = additionalMessages;
      }
    }
    
    // Combine and deduplicate results based on message id
    const combinedMessages = [...data, ...additionalData];
    const uniqueMessages = Array.from(
      new Map(combinedMessages.map(msg => [msg.id, msg])).values()
    );
    
    // Sort by created_at
    uniqueMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      messages: uniqueMessages
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 