export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utility to validate Cardano addresses
function isValidCardanoAddress(address: string): boolean {
  if (!address) return false;
  const isBaseAddress = address.startsWith('addr1') || address.startsWith('addr_test1');
  return isBaseAddress && address.length >= 90;
}

export async function POST(req: Request) {
  try {
    // Parse request body with updated fields
    const { 
      payment_address_from, 
      payment_address_to, 
      message,
      signature 
    } = await req.json();
    
    // Extra validation for required fields
    if (!payment_address_from) {
      return NextResponse.json(
        { error: 'Sender payment address is required' },
        { status: 400 }
      );
    }
    
    if (!payment_address_to) {
      return NextResponse.json(
        { error: 'Recipient payment address is required' },
        { status: 400 }
      );
    }
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: 'Message signature is required' },
        { status: 400 }
      );
    }
    
    // Log the full addresses being used - don't truncate addresses in logs
    console.log('Storing message with parameters:', {
      payment_address_from: payment_address_from,
      payment_address_to: payment_address_to,
      messageLength: message.length,
      messageSample: message.substring(0, 20) + (message.length > 20 ? '...' : ''),
      hasSignature: !!signature
    });
    
    // Validate address formats (enforce base addresses)
    if (!isValidCardanoAddress(payment_address_from) || !isValidCardanoAddress(payment_address_to)) {
      console.error('Invalid addresses detected:', { 
        fromValid: isValidCardanoAddress(payment_address_from), 
        toValid: isValidCardanoAddress(payment_address_to) 
      });
      return NextResponse.json(
        { error: 'Invalid sender or recipient address format. Both must be base addresses.' },
        { status: 400 }
      );
    }

    // Check if the user is verified by looking up their payment address
    const userResponse = await supabase
      .from("users")
      .select("last_verified")
      .eq("payment_address", payment_address_from)
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
    const lastSentKey = `last_sent_${payment_address_from}`;
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

    // Insert the message to database, using the payment addresses
    const { data, error } = await supabase
      .from('messages')
      .insert({
        payment_address_from,
        payment_address_to,
        message,
        signature: signature // Store the signature for audit purposes
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