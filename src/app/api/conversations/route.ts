export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/conversations
 * Retrieve unique conversation partners for the current user
 */
export async function GET(req: NextRequest) {
  try {
    // Get the wallet address from the request headers
    const publicAddress = req.headers.get('x-public-address');
    
    if (!publicAddress) {
      return NextResponse.json({
        error: "Authentication required. Please verify your wallet."
      }, { status: 401 });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the limit from query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Fetch conversations (unique partners the user has messaged with)
    let query = supabase
      .from('messages')
      .select('from_public_address, to_public_address, created_at, message')
      .or(
        `from_public_address.eq.${publicAddress},` +
        `to_public_address.eq.${publicAddress}`
      )
      .order('created_at', { ascending: false });

    const { data: messagesData, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({
        error: "Failed to fetch conversations",
        details: messagesError.message
      }, { status: 500 });
    }

    // Process messages to get unique conversations
    const partners = new Map();

    for (const message of messagesData || []) {
      // Determine partner address based on which field contains the user's address
      let partnerAddress = null;
      
      if (message.from_public_address === publicAddress) {
        // User is the sender
        partnerAddress = message.to_public_address;
      } else {
        // User is the recipient
        partnerAddress = message.from_public_address;
      }
      
      if (partnerAddress && !partners.has(partnerAddress)) {
        partners.set(partnerAddress, {
          partnerAddress,
          lastMessage: message.message,
          timestamp: message.created_at,
        });
      }
    }

    // Convert map to array and sort by most recent
    const conversationList = Array.from(partners.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json({ 
      success: true,
      conversations: conversationList 
    });
  } catch (error) {
    console.error('Error in conversations API:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}