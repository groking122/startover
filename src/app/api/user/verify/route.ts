export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import buffer from "buffer";
import cbor from "cbor";
import { NextRequest } from "next/server";
import { COSESign1, extractPublicKeyFromCOSEKey } from "@/utils/decodeCardanoSignature";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { message, signature, pubKey, publicAddress } = await request.json();
  console.log("Message received:", message);
  console.log("Signature:", signature);
  console.log("Public Key:", pubKey);
  console.log("Public Address:", publicAddress);

  try {
    console.log("Starting signature verification...");
    
    let isValid = false;
    let validMethod = "";
    
    // Parse message to extract addresses if they exist
    let messageObj: any = {};
    let publicAddr = publicAddress || ''; // From request body
    
    try {
      messageObj = JSON.parse(message);
      
      // Check for public address in message - prioritize this one
      if (messageObj.publicAddress) {
        publicAddr = messageObj.publicAddress;
      }
      
      // Log extracted address
      console.log("- Public address:", publicAddr ? `${publicAddr.substring(0, 10)}...` : 'none');
      
      // Fall back to URL parameter for public address if not in message or request body
      if (!publicAddr) {
        publicAddr = request.nextUrl.searchParams.get('publicAddress') || '';
        console.log("Using public address from URL:", publicAddr ? `${publicAddr.substring(0, 10)}...` : 'none');
      }
    } catch (err) {
      console.error("Error parsing message:", err);
      // If can't parse the message, try to get address from URL
      publicAddr = request.nextUrl.searchParams.get('publicAddress') || '';
      console.log("Using public address from URL (after parse error):", publicAddr ? `${publicAddr.substring(0, 10)}...` : 'none');
    }
    
    // Rate limit verification attempts
    if (publicAddr) {
      const rateLimitKey = `verify_${publicAddr}`;
      const { data: rateLimit } = await supabase
        .from('rate_limits')
        .select('timestamp')
        .eq('key', rateLimitKey)
        .single();
      
      if (rateLimit) {
        const lastVerify = new Date(rateLimit.timestamp).getTime();
        const now = Date.now();
        // Only allow verification once every 10 seconds
        if (now - lastVerify < 10000) {
          console.log("⏳ Rate limiter activated for:", publicAddr);
          return NextResponse.json({
            verified: false,
            error: "Please wait before attempting to verify again",
            retryAfter: 10 - Math.floor((now - lastVerify) / 1000)
          }, { status: 429 });
        }
      }
      
      // Update rate limit
      await supabase
        .from('rate_limits')
        .upsert({
          key: rateLimitKey,
          timestamp: new Date().toISOString()
        });
    }

    // Convert signature from hex to Buffer
    const signatureBytes = Buffer.from(signature, 'hex');
    
    // Try CIP-8 COSE verification method first
    try {
      console.log("Attempting CIP-8 COSE verification...");
      
      // Decode COSE_Sign1 structure
      const coseSignature = COSESign1.from_bytes(signatureBytes);
      
      // Get the exact bytes that were signed
      const signedData = coseSignature.signed_data();
      console.log("Signed data extracted:", signedData.toString('hex'));
      
      // Extract the signature from the COSE structure
      const signatureValue = coseSignature.signature();
      console.log("Signature value extracted:", signatureValue.toString('hex'));
      
      // Extract optional payload for validation
      const payload = coseSignature.payload();
      if (payload) {
        console.log("Payload found in COSE structure:", payload.toString('hex'));
        try {
          const decodedPayload = payload.toString('utf8');
          console.log("Decoded payload as UTF-8:", decodedPayload);
          
          // Optional: Verify the payload matches our original message
          if (decodedPayload === message) {
            console.log("Payload matches original message!");
          } else {
            console.log("Payload does not match original message");
          }
        } catch (error) {
          console.error("Error decoding payload:", error);
        }
      }
      
      // Convert pubKey (COSE_Key format) to proper raw Ed25519 key
      const pubKeyBytes = Buffer.from(pubKey, 'hex');
      let rawPubKey;
      
      try {
        console.log("Attempting to extract public key from COSE_Key...");
        // Try to extract public key from COSE_Key structure if applicable
        rawPubKey = extractPublicKeyFromCOSEKey(pubKeyBytes);
        console.log("Successfully extracted public key from COSE_Key:", rawPubKey.toString('hex'));
      } catch (error) {
        console.log("Not a COSE_Key, using raw public key:", error);
        rawPubKey = pubKeyBytes;
      }
      
      // Create CSL PublicKey and Ed25519Signature
      const publicKey = CSL.PublicKey.from_bytes(rawPubKey);
      const ed25519Sig = CSL.Ed25519Signature.from_bytes(signatureValue);
      
      // Verify against the complete signed data
      isValid = publicKey.verify(signedData, ed25519Sig);
      
      if (isValid) {
        console.log("CIP-8 COSE verification successful!");
        validMethod = "cip8-cose";
      } else {
        console.log("CIP-8 COSE verification failed");
      }
    } catch (error) {
      console.error("Error during CIP-8 COSE verification:", error);
    }
    
    // If CIP-8 verification failed, try legacy method with raw signature
    if (!isValid) {
      try {
        console.log("Attempting legacy verification with raw signature...");
        
        // Create message bytes as UTF-8
        const messageBytes = Buffer.from(message, 'utf8');
        console.log("Message bytes:", messageBytes.toString('hex'));
        
        // Convert the public key and signature from hex to bytes
        const pubKeyBytes = Buffer.from(pubKey, 'hex');
        
        // For legacy verification, we need exactly 64 bytes signature
        // Many Cardano wallets produce 128 character (64 byte) signatures
        let signatureToUse = signatureBytes;
        
        if (signatureBytes.length !== 64) {
          console.log(`Signature length (${signatureBytes.length} bytes) is not 64 bytes, attempting to normalize...`);
          
          if (signatureBytes.length === 70) {
            // Some wallets wrap in a CBOR structure that adds 6 bytes
            console.log("Signature appears to be 70 bytes, extracting middle 64 bytes");
            signatureToUse = signatureBytes.slice(3, 67);
          } else if (signatureBytes.length === 72) {
            // Some CBOR structures have different formats
            console.log("Signature appears to be 72 bytes, extracting middle 64 bytes");
            signatureToUse = signatureBytes.slice(4, 68);
          } else if (signatureBytes.length > 64) {
            // If all else fails, just try the last 64 bytes
            console.log("Using last 64 bytes of signature");
            signatureToUse = signatureBytes.slice(signatureBytes.length - 64);
          }
          
          console.log("Normalized signature:", signatureToUse.toString('hex'));
        }
        
        // Create CSL objects for verification
        const publicKey = CSL.PublicKey.from_bytes(pubKeyBytes);
        const ed25519Sig = CSL.Ed25519Signature.from_bytes(signatureToUse);
        
        // Verify the signature
        isValid = publicKey.verify(messageBytes, ed25519Sig);
        
        if (isValid) {
          console.log("Legacy verification successful!");
          validMethod = "legacy-raw";
        } else {
          console.log("Legacy verification failed");
        }
      } catch (error) {
        console.error("Error during legacy verification:", error);
      }
    }
    
    // Final verification result
    console.log("Final verification result:", isValid);
    
    if (isValid) {
      // Validate public address format
      const hasValidPublicAddress = publicAddr && (publicAddr.startsWith('addr1') || publicAddr.startsWith('addr_test1'));
      
      if (!hasValidPublicAddress) {
        console.error("No valid public address provided:", publicAddr);
        return NextResponse.json({ 
          verified: false,
          error: "No valid public address provided. Public addresses must start with 'addr1' or 'addr_test1'."
        }, { status: 400 });
      }
      
      // Update or create user record in database
      try {
        console.log("Upserting user in database...");
        
        // Prepare user data
        const userData: any = {
          public_key: pubKey,
          last_verified: new Date().toISOString(),
          public_address: publicAddr
        };
        
        console.log(`Upserting user with public_address:`, publicAddr);
        
        const { error } = await supabase
          .from('users')
          .upsert(userData, { onConflict: 'public_address' });

        if (error) {
          console.error("Database error:", error);
          return NextResponse.json({ 
            verified: true,
            method: validMethod,
            message: "Signature verified successfully, but database update failed",
            error: error.message
          });
        }
        
        console.log("User record updated successfully");
        
        // Return success response
        return NextResponse.json({ 
          verified: true, 
          publicAddress: publicAddr,
          method: validMethod 
        });
      } catch (dbError) {
        console.error("Database operation error:", dbError);
        return NextResponse.json({ 
          verified: true, 
          method: validMethod,
          message: "Signature verified successfully, but database operation failed",
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } else {
      return NextResponse.json({ 
        verified: false, 
        error: "Signature verification failed" 
      }, { status: 401 });
    }
    
  } catch (error) {
    console.error("Verification process error:", error);
    return NextResponse.json({ 
      verified: false, 
      error: error instanceof Error ? error.message : "An unknown error occurred" 
    }, { status: 500 });
  }
} 