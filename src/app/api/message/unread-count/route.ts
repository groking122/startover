export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limiting settings
const UNREAD_COUNT_RATE_LIMIT = 20; // requests per window
const UNREAD_COUNT_RATE_WINDOW = 30; // seconds

// Type for the count by partner result
interface CountByPartner {
  from_address: string;
  from_public_address: string | null;
  count: number | string;
}

/**
 * GET /api/message/unread-count
 * Get the number of unread messages for the current user
 */
export async function GET(req: Request) {
  try {
    // Get the validated wallet address from the session middleware
    const walletAddress = req.headers.get('x-wallet-address');
    
    if (!walletAddress) {
      return NextResponse.json({
        error: "Authentication required. Please verify your wallet."
      }, { status: 401 });
    }
    
    // Check rate limiting
    const rateLimitKey = getRateLimitKey('unread_count', walletAddress);
    const rateLimitCheck = await checkRateLimit(
      rateLimitKey, 
      UNREAD_COUNT_RATE_LIMIT, 
      UNREAD_COUNT_RATE_WINDOW
    );
    
    if (!rateLimitCheck.success) {
      return NextResponse.json({
        error: "Rate limit exceeded for fetching unread count",
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

    // Get query parameters
    const url = new URL(req.url);
    const partnerId = url.searchParams.get('partner');
    
    // If partner ID is provided, get unread count for just that conversation
    if (partnerId) {
      // Check both stake addresses and public addresses
      const { data, error, count } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .or(`and(to_address.eq.${walletAddress},from_address.eq.${partnerId}),` +
            `and(to_public_address.eq.${walletAddress},from_public_address.eq.${partnerId}),` +
            `and(to_address.eq.${walletAddress},from_public_address.eq.${partnerId}),` +
            `and(to_public_address.eq.${walletAddress},from_address.eq.${partnerId})`)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread count for conversation:', error);
        return NextResponse.json({
          error: "Failed to fetch unread count",
          details: error.message
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        unreadCount: count || 0,
        rateLimit: {
          limit: rateLimitCheck.limit,
          remaining: rateLimitCheck.remaining,
          resetAt: rateLimitCheck.resetAt.toISOString()
        }
      });
    }
    
    // Get total unread count
    const { data, error, count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .or(`to_address.eq.${walletAddress},to_public_address.eq.${walletAddress}`)
      .eq('is_read', false);
    
    if (error) {
      console.error('Error fetching unread count:', error);
      return NextResponse.json({
        error: "Failed to fetch unread count",
        details: error.message
      }, { status: 500 });
    }
    
    // Get counts by sender using raw SQL query
    const { data: countsByPartner, error: countByPartnerError } = await supabase
      .rpc('get_unread_counts_by_sender', {
        user_address: walletAddress
      });
    
    if (countByPartnerError) {
      console.error('Error fetching unread count by partner:', countByPartnerError);
    }
    
    // Format the by-partner counts
    const unreadByPartner: Record<string, number> = {};
    if (countsByPartner) {
      (countsByPartner as CountByPartner[]).forEach((item: CountByPartner) => {
        // Use the appropriate address - prefer stake address for backward compatibility
        const partnerKey = item.from_address || item.from_public_address;
        if (partnerKey) {
          unreadByPartner[partnerKey] = typeof item.count === 'string'
            ? parseInt(item.count)
            : item.count;
        }
      });
    }
    
    // Return the counts
    return NextResponse.json({
      success: true,
      unreadCount: count || 0,
      unreadByPartner,
      rateLimit: {
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining,
        resetAt: rateLimitCheck.resetAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in GET /api/message/unread-count:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 