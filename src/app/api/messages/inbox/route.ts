import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const paymentAddress = req.nextUrl.searchParams.get('paymentAddress');

  if (!paymentAddress) {
    return NextResponse.json({
      success: false,
      error: "Payment address required to fetch messages."
    }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // ✅ Fetch messages where the user is sender or receiver
    const { data, error } = await supabase.from("messages")
      .select("*")
      .or(`payment_address_from.eq.${paymentAddress},payment_address_to.eq.${paymentAddress}`)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return NextResponse.json({
        success: false,
        error: "Failed to fetch messages",
        detail: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messages: data
    });

  } catch (err: any) {
    console.error("❌ API internal fetch error:", err);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      detail: err.message
    }, { status: 500 });
  }
} 