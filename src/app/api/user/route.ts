import { NextResponse } from 'next/server';
import supabaseAdmin from '@/utils/supabaseClient';

export async function POST(req: Request) {
  try {
    const { stakeAddress } = await req.json();

    if (!stakeAddress) {
      return NextResponse.json({ error: 'Missing stakeAddress' }, { status: 400 });
    }

    // Just validate that the address is long enough
    if (stakeAddress.length < 30) {
      return NextResponse.json({ 
        error: 'Invalid address format. Address must be at least 30 characters long' 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({ stake_address: stakeAddress }, { onConflict: 'stake_address' });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error processing request:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
} 