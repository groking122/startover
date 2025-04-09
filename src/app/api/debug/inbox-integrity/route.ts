import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveToStakeAddress } from '@/utils/client/stakeUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('Running inbox integrity check for recipient fields...');
    
    // Only available in development environment for security
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }
    
    // Fetch all messages from the database
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, from, to, to_address, created_at');

    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    console.log(`Retrieved ${messages.length} total messages for analysis`);

    // Check for messages where 'to' is not a stake address
    const nonStakeRecipients = messages.filter(msg => !msg.to.startsWith('stake1'));
    
    // Check for messages with base address duplicated in 'to' and 'to_address'
    const duplicatedAddresses = messages.filter(
      msg => msg.to_address && msg.to === msg.to_address
    );
    
    // Check for messages with null 'to' field
    const nullToField = messages.filter(msg => !msg.to);
    
    // Check for messages with base address in 'to' field
    const baseAddressInTo = messages.filter(
      msg => msg.to.startsWith('addr1') || msg.to.startsWith('addr_test1')
    );

    // Compile the results
    const results = {
      totalMessages: messages.length,
      issues: {
        nonStakeRecipients: {
          count: nonStakeRecipients.length,
          examples: nonStakeRecipients.slice(0, 5).map(msg => ({
            id: msg.id,
            to: msg.to,
            to_address: msg.to_address,
            created_at: msg.created_at
          }))
        },
        duplicatedAddresses: {
          count: duplicatedAddresses.length,
          examples: duplicatedAddresses.slice(0, 5).map(msg => ({
            id: msg.id,
            to: msg.to,
            to_address: msg.to_address,
            created_at: msg.created_at
          }))
        },
        nullToField: {
          count: nullToField.length,
          examples: nullToField.slice(0, 5).map(msg => ({
            id: msg.id,
            to: msg.to,
            to_address: msg.to_address,
            created_at: msg.created_at
          }))
        },
        baseAddressInTo: {
          count: baseAddressInTo.length,
          examples: baseAddressInTo.slice(0, 5).map(msg => ({
            id: msg.id,
            to: msg.to,
            to_address: msg.to_address,
            created_at: msg.created_at
          }))
        }
      }
    };

    console.log(`Analysis complete. Found ${nonStakeRecipients.length} messages with non-stake recipients`);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in inbox integrity check:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 