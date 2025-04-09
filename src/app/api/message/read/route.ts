export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limiting settings
const READ_RATE_LIMIT = 20; // requests per window
const READ_RATE_WINDOW = 60; // seconds

/**
 * POST /api/message/read
 * Mark messages as read for the current user
 */
export async function POST(req: Request) {
  try {
    // Get the validated wallet address from the session middleware
    const walletAddress = req.headers.get('x-wallet-address');
    
    if (!walletAddress) {
      return NextResponse.json({
        error: "Authentication required. Please verify your wallet."
      }, { status: 401 });
    }
    
    // Parse the request body
    const { messageIds, partnerId } = await req.json();
    
    // Basic validation
    if (!messageIds && !partnerId) {
      return NextResponse.json({
        error: "Missing required fields: either messageIds or partnerId is required"
      }, { status: 400 });
    }
    
    // Check rate limiting
    const rateLimitKey = getRateLimitKey('read', walletAddress);
    const rateLimitCheck = await checkRateLimit(
      rateLimitKey, 
      READ_RATE_LIMIT, 
      READ_RATE_WINDOW
    );
    
    if (!rateLimitCheck.success) {
      return NextResponse.json({
        error: "Rate limit exceeded for marking messages as read",
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

    let updatedCount = 0;

    // If specific message IDs are provided
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Update only the specified messages that are sent to this user
      // Check both stake address and public address
      const { data, error, count } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds)
        .or(`to_address.eq.${walletAddress},to_public_address.eq.${walletAddress}`)
        .select('id');
        
      if (error) {
        console.error('Error marking messages as read:', error);
        return NextResponse.json({
          error: "Failed to mark messages as read",
          details: error.message
        }, { status: 500 });
      }
      
      updatedCount = count || 0;
    } 
    // If a partner ID is provided, mark all messages from that partner as read
    else if (partnerId) {
      // Check all possible combinations of stake and public addresses
      const { data, error, count } = await supabase
        .from('messages')
        .update({ is_read: true })
        .or(`and(from_address.eq.${partnerId},to_address.eq.${walletAddress}),` +
            `and(from_public_address.eq.${partnerId},to_public_address.eq.${walletAddress}),` +
            `and(from_address.eq.${partnerId},to_public_address.eq.${walletAddress}),` +
            `and(from_public_address.eq.${partnerId},to_address.eq.${walletAddress})`)
        .eq('is_read', false)
        .select('id');
        
      if (error) {
        console.error('Error marking conversation as read:', error);
        return NextResponse.json({
          error: "Failed to mark conversation as read",
          details: error.message
        }, { status: 500 });
      }
      
      updatedCount = count || 0;
    }

    // Return success with count of updated messages
    return NextResponse.json({
      success: true,
      updatedCount,
      rateLimit: {
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining,
        resetAt: rateLimitCheck.resetAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in POST /api/message/read:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 