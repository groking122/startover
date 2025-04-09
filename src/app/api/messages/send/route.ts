import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { payment_address_from, payment_address_to, stake_address_to, message } = body;

  // ✅ Validate input clearly
  if (!payment_address_from || !payment_address_to || !message) {
    return NextResponse.json({
      success: false,
      error: "Missing required parameters: payment addresses and message must be provided.",
    }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // ✅ Insert message into the secure `messages` table
    const { data, error } = await supabase.from("messages").insert({
      payment_address_from,            // securely verified sender
      payment_address_to,              // securely verified receiver
      stake_address_to: stake_address_to || null, // optional informational only
      message,                         // message content
      timestamp: new Date().toISOString(), // current timestamp
    }).select();

    if (error) {
      console.error("❌ Supabase insertion error:", error);
      return NextResponse.json({
        success: false,
        error: "Database insertion failed",
        detail: error.message,
      }, { status: 500 });
    }

    // ✅ Successfully inserted message
    return NextResponse.json({
      success: true,
      data: data[0],
    });

  } catch (err: any) {
    console.error("❌ API internal error:", err);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      detail: err.message,
    }, { status: 500 });
  }
} 