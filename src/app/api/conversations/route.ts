export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GetConversationsResponse, Conversation } from '@/types/messages';
import { isValidCardanoAddress } from '@/utils/addressUtils';
import { checkRateLimit, getRateLimitKey } from '@/utils/rateLimit';
import { headers } from 'next/headers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Rate limit parameters
const RATE_LIMIT_TOKENS = 50;
const RATE_LIMIT_WINDOW_SEC = 60;

/**
 * GET /api/conversations
 * Returns a list of conversations for the authenticated user
 */
export async function GET(request: NextRequest): Promise<NextResponse<GetConversationsResponse>> {
  // Get the requesting user's stake address from the header
  const headersList = await headers();
  const stakeAddress = headersList.get('x-stake-address');
  
  // Validate authentication
  if (!stakeAddress) {
    return NextResponse.json(
      { success: false, conversations: [], error: 'Unauthorized', details: 'Missing stake address' },
      { status: 401 }
    );
  }

  // Validate the stake address
  if (!isValidCardanoAddress(stakeAddress)) {
    return NextResponse.json(
      { success: false, conversations: [], error: 'Bad Request', details: 'Invalid stake address format' },
      { status: 400 }
    );
  }

  // Check rate limit
  const rateLimitKey = getRateLimitKey('get_conversations', stakeAddress);
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    RATE_LIMIT_TOKENS,
    RATE_LIMIT_WINDOW_SEC
  );

  if (!rateLimitResult.success) {
    const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        conversations: [],
        error: 'Too Many Requests',
        details: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfterSeconds.toString()
        }
      }
    );
  }

  try {
    // Initialize Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all unique conversation partners
    const { data: sentMessages, error: sentError } = await supabase
      .from('messages')
      .select('to_address, to_public_address')
      .eq('from_address', stakeAddress)
      .order('created_at', { ascending: false });

    const { data: receivedMessages, error: receivedError } = await supabase
      .from('messages')
      .select('from_address, from_public_address')
      .eq('to_address', stakeAddress)
      .order('created_at', { ascending: false });

    if (sentError || receivedError) {
      throw new Error(sentError?.message || receivedError?.message || 'Error fetching messages');
    }

    // Combine partners into a unique set
    const uniquePartners = new Set<string>();
    sentMessages?.forEach(msg => uniquePartners.add(msg.to_address));
    receivedMessages?.forEach(msg => uniquePartners.add(msg.from_address));

    // Get conversations data for each partner
    const conversations: Conversation[] = [];

    for (const partnerAddress of uniquePartners) {
      // Get the last message
      const { data: lastMessage, error: lastMessageError } = await supabase
        .from('messages')
        .select('*')
        .or(`from_address.eq.${partnerAddress},to_address.eq.${partnerAddress}`)
        .or(`from_address.eq.${stakeAddress},to_address.eq.${stakeAddress}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastMessageError) {
        console.error('Error fetching last message:', lastMessageError);
        continue;
      }

      // Get unread count
      const { count: unreadCount, error: unreadError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_address', partnerAddress)
        .eq('to_address', stakeAddress)
        .eq('is_read', false);

      if (unreadError) {
        console.error('Error fetching unread count:', unreadError);
        continue;
      }

      // Check if partner is verified
      const { data: partnerData, error: partnerError } = await supabase
        .from('users')
        .select('is_verified')
        .eq('stake_address', partnerAddress)
        .maybeSingle();

      if (partnerError) {
        console.error('Error fetching partner verification status:', partnerError);
      }

      // Get public address for the partner
      let partner_public_address = null;
      if (lastMessage.from_address === partnerAddress) {
        partner_public_address = lastMessage.from_public_address;
      } else if (lastMessage.to_address === partnerAddress) {
        partner_public_address = lastMessage.to_public_address;
      }

      // Add conversation to the list
      conversations.push({
        partner_address: partnerAddress,
        partner_public_address: partner_public_address || undefined,
        last_message: lastMessage.message,
        last_message_id: lastMessage.id,
        last_message_time: lastMessage.created_at,
        unread_count: unreadCount || 0,
        is_partner_verified: partnerData?.is_verified || false
      });
    }

    // Sort conversations by last message time (newest first)
    conversations.sort((a, b) => {
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    return NextResponse.json({
      success: true,
      conversations
    });

  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { 
        success: false, 
        conversations: [], 
        error: 'Internal Server Error', 
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}