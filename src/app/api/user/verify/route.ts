export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  PublicKey, 
  Ed25519Signature,
  Address,
  BaseAddress,
  Credential,
  RewardAddress,
  NetworkInfo
} from '@emurgo/cardano-serialization-lib-asmjs';
import { NextRequest } from "next/server";

// Import COSE library
import { COSESign1, COSEKey, Label, Int } from '@emurgo/cardano-message-signing-nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { baseAddress, message, signature, key } = await request.json();
    
    console.log("Verification request received:", {
      baseAddress: baseAddress?.substring(0, 15) + "...",
      messageLength: message?.length,
      signatureLength: signature?.length,
      keyLength: key?.length
    });
    
    // Validate required parameters
    if (!baseAddress || !message || !signature || !key) {
      const missingParams = [];
      if (!baseAddress) missingParams.push('baseAddress');
      if (!message) missingParams.push('message');
      if (!signature) missingParams.push('signature');
      if (!key) missingParams.push('key');
      
      return NextResponse.json({
        success: false,
        error: `Missing required parameters: ${missingParams.join(', ')}`
      }, { status: 400 });
    }
    
    // Validate baseAddress format
    if (!baseAddress.startsWith('addr1') && !baseAddress.startsWith('addr_test1')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid base address format'
      }, { status: 400 });
    }
    
    try {
      // Parse COSE structures
      const coseSign1 = COSESign1.from_bytes(Buffer.from(signature, "hex"));
      const coseKey = COSEKey.from_bytes(Buffer.from(key, "hex"));
      
      // Use Label.new_int to create the label and ensure the header exists
      const labelObj = Label.new_int(Int.new_i32(-2));
      const headerValue = coseKey.header(labelObj);
      
      if (!headerValue) {
        return NextResponse.json({
          success: false,
          error: 'Invalid COSE key: missing public key in header'
        }, { status: 400 });
      }
      
      const pubKeyBytes = headerValue.as_bytes();
      if (!pubKeyBytes) {
        return NextResponse.json({
          success: false,
          error: 'Invalid COSE key: public key bytes could not be extracted'
        }, { status: 400 });
      }
      
      const pubKey = PublicKey.from_bytes(pubKeyBytes);
      
      // Verify signature matches signed message
      const signedBytes = coseSign1.signed_data().to_bytes();
      const sigObj = Ed25519Signature.from_bytes(coseSign1.signature());
      const verified = pubKey.verify(signedBytes, sigObj);
      
      if (!verified) {
        return NextResponse.json({
          success: false,
          error: 'Signature verification failed'
        }, { status: 400 });
      }
      
      // Determine network ID from the base address
      const isTestnet = baseAddress.startsWith('addr_test1');
      const networkId = isTestnet ? 0 : 1;
      
      // Check baseAddress matches publicKey's payment credential
      const paymentCred = Credential.from_keyhash(pubKey.hash());
      const expectedAddr = BaseAddress.new(
        networkId, 
        paymentCred,
        paymentCred // Using same credential for both payment and stake parts
      ).to_address().to_bech32();
      
      console.log("Address verification:", {
        providedAddress: baseAddress.substring(0, 15) + "...",
        expectedAddress: expectedAddr.substring(0, 15) + "...",
        match: expectedAddr === baseAddress
      });
      
      if (expectedAddr !== baseAddress) {
        return NextResponse.json({
          success: false,
          error: 'Address mismatch - the provided address does not match the public key'
        }, { status: 400 });
      }
      
      // Save verified info to Supabase
      const publicKeyHex = Buffer.from(pubKeyBytes).toString('hex');
      const { error: dbError } = await supabase.from('users').upsert({
        payment_address: baseAddress,
        public_key: publicKeyHex,
        signature: signature,
        last_verified: new Date().toISOString()
      }, { onConflict: 'payment_address' });
      
      if (dbError) {
        console.error("Database error:", dbError);
        return NextResponse.json({ 
          success: true,
          verified: true,
          message: "Signature verified successfully, but database update failed",
          error: dbError.message
        });
      }
      
      return NextResponse.json({
        success: true,
        verified: true,
        message: "Wallet verification successful"
      });
      
    } catch (error) {
      console.error("Verification processing error:", error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during verification processing"
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Request parsing error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Invalid request format"
    }, { status: 400 });
  }
} 