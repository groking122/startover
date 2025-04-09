export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySignature } from '@/utils/verifySignature';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';
import { isValidCardanoAddress, isPublicAddress } from '@/utils/addressUtils';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limiting settings for message sending
const MESSAGE_RATE_LIMIT = 5; // messages per window
const MESSAGE_RATE_WINDOW = 10; // seconds

// Define a type for the user insert object
interface UserInsert {
  created_at: string;
  public_address: string;
  last_verified?: string | null;
}

/**
 * POST /api/message
 * Send a message to another user
 */
export async function POST(req: Request) {
  try {
    // Get the sender address from the session middleware
    const senderAddress = req.headers.get('x-public-address');
    
    if (!senderAddress) {
      return NextResponse.json({
        error: "Authentication required. Please verify your wallet."
      }, { status: 401 });
    }
    
    // Parse the request body
    const { to, message, signature, publicKey } = await req.json();
    
    // Basic validation
    if (!to || !message) {
      return NextResponse.json({
        error: "Missing required fields: recipient and message are required"
      }, { status: 400 });
    }
    
    // Validate recipient address format
    if (!isValidCardanoAddress(to)) {
      return NextResponse.json({
        error: "Invalid recipient address format"
      }, { status: 400 });
    }
    
    // Ensure recipient is a public address
    if (!isPublicAddress(to)) {
      return NextResponse.json({
        error: "Recipient must be a public address (starts with addr1 or addr_test1)"
      }, { status: 400 });
    }
    
    // Check rate limiting
    const rateLimitKey = getRateLimitKey('message', senderAddress);
    const rateLimitCheck = await checkRateLimit(
      rateLimitKey, 
      MESSAGE_RATE_LIMIT, 
      MESSAGE_RATE_WINDOW
    );
    
    if (!rateLimitCheck.success) {
      return NextResponse.json({
        error: "Rate limit exceeded for message sending",
        retryAfter: rateLimitCheck.resetAt.toISOString(),
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining
      }, { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000).toString()
        }
      });
    }

    // Check if the recipient exists or create a placeholder record
    const recipientCheck = await supabase
      .from('users')
      .select('public_address, last_verified')
      .eq('public_address', to)
      .single();
      
    if (recipientCheck.error || !recipientCheck.data) {
      // For privacy reasons, don't disclose if user exists or not
      // Instead create a placeholder record if user doesn't exist yet
      try {
        const userInsert: UserInsert = {
          created_at: new Date().toISOString(),
          public_address: to,
          last_verified: null
        };
        
        await supabase
          .from('users')
          .upsert(userInsert);
      } catch (error) {
        console.error('Error creating user placeholder:', error);
        // Continue even if placeholder creation fails
      }
    }

    // Check if the sender exists and has been verified
    const userResponse = await supabase
      .from("users")
      .select("last_verified, public_address, public_key")
      .eq('public_address', senderAddress)
      .single();
      
    if (!userResponse.data) {
      return NextResponse.json({
        error: "User not found. Please verify your wallet first."
      }, { status: 401 });
    }
    
    const userData = userResponse.data;

    // Verify the message is authentic
    // Option 1: Check the specific message signature if provided
    if (signature && publicKey) {
      console.log("Verifying provided signature for this specific message");
      
      // Create a message object to verify
      const messageToVerify = JSON.stringify({
        action: "send_message",
        from: senderAddress,
        to,
        message,
        timestamp: new Date().toISOString()
      });
      
      // Verify the signature
      const isValid = await verifySignature(publicKey, messageToVerify, signature);
      
      if (!isValid) {
        console.error("Invalid signature for message");
        return NextResponse.json({
          error: "Invalid signature for message"
        }, { status: 401 });
      }
      
      console.log("✅ Message signature verified!");
    }
    // Option 2: Check session verification with expiration time
    else {
      if (!userData.last_verified) {
        return NextResponse.json({
          error: "User not verified. Please verify your wallet first."
        }, { status: 401 });
      }
      
      // Check how old the verification is
      const age = Date.now() - new Date(userData.last_verified).getTime();
      if (age > 60 * 60 * 1000) { // 1 hour timeout
        return NextResponse.json({
          error: "Session expired, please re-verify your wallet"
        }, { status: 401 });
      }
      
      console.log("✅ User session is valid!");
    }

    // Insert the message into the database
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        from_public_address: senderAddress,
        to_public_address: to,
        message,
        signature: signature || null,
        public_key: publicKey || null,
        created_at: new Date().toISOString()
      })
      .select('id, created_at');
      
    if (messageError) {
      console.error('Error inserting message:', messageError);
      return NextResponse.json({
        error: "Failed to save message",
        details: messageError.message
      }, { status: 500 });
    }
    
    // Return the message ID and timestamp
    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      id: messageData?.[0]?.id,
      timestamp: messageData?.[0]?.created_at,
      rateLimit: {
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining,
        resetAt: rateLimitCheck.resetAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in /api/message:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * GET /api/message
 * Retrieve messages for the current user
 */
export async function GET(req: Request) {
  try {
    // Get the wallet address from the session middleware
    const publicAddress = req.headers.get('x-public-address');
    
    if (!publicAddress) {
      return NextResponse.json({
        error: "Authentication required. Please verify your wallet."
      }, { status: 401 });
    }
    
    // Get query parameters for filtering and pagination
    const url = new URL(req.url);
    const partner = url.searchParams.get('partner');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const before = url.searchParams.get('before');
    
    // Build the query
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // Cap at 100 messages max
    
    // Filter by conversation if partner is specified
    if (partner) {
      // Check only public addresses for the conversation
      query = query.or(
        `and(from_public_address.eq.${publicAddress},to_public_address.eq.${partner}),` +
        `and(from_public_address.eq.${partner},to_public_address.eq.${publicAddress})`
      );
    } else {
      // Just get messages for this user
      query = query.or(
        `from_public_address.eq.${publicAddress},` +
        `to_public_address.eq.${publicAddress}`
      );
    }
    
    // Add pagination if 'before' timestamp is specified
    if (before) {
      query = query.lt('created_at', before);
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({
        error: "Failed to retrieve messages",
        details: error.message
      }, { status: 500 });
    }
    
    // Update read status for incoming messages
    const incomingMessageIds = data
      ?.filter(msg => msg.to_public_address === publicAddress && !msg.is_read)
      .map(msg => msg.id);
      
    if (incomingMessageIds && incomingMessageIds.length > 0) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', incomingMessageIds);
    }
    
    // Return the messages
    return NextResponse.json({
      success: true,
      messages: data || []
    });
    
  } catch (error) {
    console.error('Error in GET /api/message:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 