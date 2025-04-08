import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveInboxPartners } from '@/utils/inboxHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('Running inbox integrity check...');
    
    // Fetch all messages from the database
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*');

    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    console.log(`Retrieved ${messages.length} total messages for analysis`);

    // Extract all unique addresses from messages
    const addresses = new Set<string>();
    messages.forEach((m) => {
      if (m.from) addresses.add(m.from);
      if (m.to) addresses.add(m.to);
      if (m.to_address) addresses.add(m.to_address);
    });

    console.log(`Found ${addresses.size} unique addresses to check`);

    // Check for anomalies where an address doesn't see its conversation partners
    const anomalies: Record<string, string[]> = {};
    const addressList = Array.from(addresses);

    // Track message counts for statistical analysis
    const messageCounts: Record<string, number> = {};
    addressList.forEach(addr => {
      messageCounts[addr] = 0;
    });

    // Count messages per address
    messages.forEach(m => {
      if (m.from) messageCounts[m.from] = (messageCounts[m.from] || 0) + 1;
      // Count receiving a message too
      if (m.to) messageCounts[m.to] = (messageCounts[m.to] || 0) + 1;
      if (m.to_address) messageCounts[m.to_address] = (messageCounts[m.to_address] || 0) + 1;
    });

    // Check each address for conversation partners
    for (const addr of addressList) {
      const partners = resolveInboxPartners(messages, addr);
      
      // If no partners are found despite having messages, record as anomaly
      if (!partners || partners.length === 0) {
        // Find messages where this address is involved
        const relatedMessages = messages.filter(m => 
          m.from === addr || m.to === addr || m.to_address === addr
        );
        
        if (relatedMessages.length > 0) {
          anomalies[addr] = relatedMessages.map(m => 
            `Message ID: ${m.id || 'Unknown'}, From: ${m.from}, To: ${m.to}, ToAddress: ${m.to_address || 'N/A'}`
          );
          console.warn(`Anomaly detected for address ${addr}: Has ${relatedMessages.length} messages but 0 partners`);
        }
      }
    }

    // Get addresses with most messages for statistical purposes
    const topAddresses = addressList
      .sort((a, b) => messageCounts[b] - messageCounts[a])
      .slice(0, 10)
      .map(addr => ({ 
        address: addr, 
        messageCount: messageCounts[addr],
        partnerCount: resolveInboxPartners(messages, addr).length
      }));

    const anomalyCount = Object.keys(anomalies).length;
    console.log(`Found ${anomalyCount} anomalies out of ${addresses.size} addresses`);

    return NextResponse.json({
      totalMessages: messages.length,
      totalAddresses: addresses.size,
      anomalyCount,
      anomalies,
      stats: {
        topAddresses
      }
    });
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