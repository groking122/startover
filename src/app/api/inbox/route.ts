export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/inbox
 * Legacy endpoint that returns partners list for the inbox
 * This is for backwards compatibility with the original inbox implementation
 */
export async function GET(req: Request) {
  try {
    // Get the query parameters
    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({
        error: "Missing 'address' parameter"
      }, { status: 400 });
    }

    // Forward the request to our new conversations endpoint by fetching it internally
    const conversationsRes = await fetch(new URL('/api/conversations', req.url).toString(), {
      headers: {
        'x-stake-address': address
      }
    });

    // If the conversations endpoint returns an error, forward it
    if (!conversationsRes.ok) {
      const error = await conversationsRes.json();
      return NextResponse.json(error, { status: conversationsRes.status });
    }

    // Get the conversations data
    const conversationsData = await conversationsRes.json();
    
    // Extract just the partner addresses for backward compatibility
    const partners = conversationsData.conversations.map(
      (conv: any) => conv.partner_address
    );

    // Return formatted response to match the expected format in the old Inbox component
    return NextResponse.json({
      success: true,
      partners
    });
  } catch (error) {
    console.error('Error in /api/inbox:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 