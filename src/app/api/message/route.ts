export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySignature } from '@/utils/verifySignature';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utility to validate Cardano addresses
function isValidCardanoAddress(address: string): boolean {
  if (!address) return false;
  const isStakeAddress = address.startsWith('stake1');
  const isBaseAddress = address.startsWith('addr1') || address.startsWith('addr_test1');
  return (isStakeAddress || isBaseAddress) && address.length >= 50;
}

export async function POST(req: Request) {
  try {
    // Parse request body
    const { from, to, toAddress, message } = await req.json();
    
    // Extra validation for required fields
    if (!from) {
      return NextResponse.json(
        { error: 'Sender address is required' },
        { status: 400 }
      );
    }
    
    if (!to) {
      return NextResponse.json(
        { error: 'Recipient address is required' },
        { status: 400 }
      );
    }
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }
    
    // Log the full addresses being used - don't truncate addresses in logs
    console.log('Storing message with parameters:', {
      from: from,
      to: to,
      to_address: toAddress,
      messageLength: message.length,
      messageSample: message.substring(0, 20) + (message.length > 20 ? '...' : '')
    });
    
    // Strict validation: 'to' field must be a stake address for proper inbox routing
    if (!to.startsWith('stake1')) {
      console.error('Invalid recipient: "to" field must be a stake address but received:', to);
      return NextResponse.json(
        { error: 'Recipient must be a stake address' },
        { status: 400 }
      );
    }
    
    // Validate address formats (rather than just checking prefixes)
    if (!isValidCardanoAddress(from) || !isValidCardanoAddress(to)) {
      console.error('Invalid addresses detected:', { 
        fromValid: isValidCardanoAddress(from), 
        toValid: isValidCardanoAddress(to) 
      });
      return NextResponse.json(
        { error: 'Invalid sender or recipient address format' },
        { status: 400 }
      );
    }
    
    // If toAddress is provided, validate it's a base address
    if (toAddress && !toAddress.startsWith('addr1') && !toAddress.startsWith('addr_test1')) {
      console.error('Invalid toAddress: Expected base address but received:', toAddress);
      return NextResponse.json(
        { error: 'toAddress must be a base address' },
        { status: 400 }
      );
    }

    // Check if the user's session is expired (verification older than 1 hour)
    const userResponse = await supabase
      .from("users")
      .select("last_verified")
      .eq("stake_address", from)
      .single();
      
    if (!userResponse.data?.last_verified) {
      return NextResponse.json({
        error: "User not verified"
      }, { status: 401 });
    }
    
    const userData = userResponse.data;
    const age = Date.now() - new Date(userData.last_verified).getTime();
    if (age > 60 * 60 * 1000) {
      return NextResponse.json({
        error: "Session expired, re-verify"
      }, { status: 401 });
    }

    // Add rate limiting
    const cooldownWindowMs = 3000; // 3 seconds

    // Use Supabase to track last message sent
    const lastSentKey = `last_sent_${from}`;
    const lastSentResponse = await supabase
      .from("rate_limits")
      .select("timestamp")
      .eq("key", lastSentKey)
      .single();

    const now = Date.now();
    const lastSent = lastSentResponse?.data?.timestamp
      ? new Date(lastSentResponse.data.timestamp).getTime()
      : 0;

    if (now - lastSent < cooldownWindowMs) {
      return NextResponse.json({ error: "You're sending messages too fast" }, { status: 429 });
    }

    // Update the rate limit record
    await supabase
      .from("rate_limits")
      .upsert({ key: lastSentKey, timestamp: new Date().toISOString() });

    // Insert the message to database, ensuring full addresses are stored
    const { data, error } = await supabase
      .from('messages')
      .insert({
        from,            // Full stake address
        to,              // Full stake address 
        to_address: toAddress, // Full base address when provided
        message
      });
      
    if (error) {
      console.error('Error inserting message:', error);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 