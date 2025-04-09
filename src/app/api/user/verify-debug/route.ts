export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import { COSESign1, extractPublicKeyFromCOSEKey } from "@/utils/decodeCardanoSignature";
import cbor from 'cbor';

// Define proper types for verification results
interface VerificationResult {
  valid: boolean;
  error?: string;
}

interface VerificationResults {
  [key: string]: VerificationResult;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stakeAddress, pubKey, signature, message } = body;

    console.log("📊 Verify-Debug received request");

    if (!pubKey || !signature || !message) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['pubKey', 'signature', 'message'],
        received: Object.keys(body)
      }, { status: 400 });
    }

    // Process inputs
    const pubKeyBytes = Buffer.from(pubKey, 'hex');
    const sigBytes = Buffer.from(signature, 'hex');
    
    // Prepare different message formats for testing
    const messageFormats: Record<string, Buffer | null> = {
      direct: Buffer.from(message),
      utf8: Buffer.from(message, 'utf8'),
      hexAsString: /^[0-9a-f]+$/i.test(message) ? Buffer.from(message, 'utf8') : null,
      hexDecoded: /^[0-9a-f]+$/i.test(message) ? Buffer.from(message, 'hex') : null,
    };

    let verificationResults: VerificationResults = {};
    
    // Try CIP-8 COSE verification
    try {
      console.log("Attempting CIP-8 COSE verification...");
      
      // Extract raw public key if it's in COSE format
      let rawPubKey;
      try {
        console.log("Attempting to extract public key from COSE_Key...");
        rawPubKey = extractPublicKeyFromCOSEKey(pubKeyBytes);
        console.log("Successfully extracted public key from COSE_Key:", rawPubKey.toString('hex'));
      } catch (error) {
        console.log("Not a COSE_Key, using raw public key");
        rawPubKey = pubKeyBytes;
      }
      
      const publicKey = CSL.PublicKey.from_bytes(rawPubKey);
      
      // Try COSE signature verification
      try {
        const coseSignature = COSESign1.from_bytes(sigBytes);
        const signedData = coseSignature.signed_data();
        const signatureValue = coseSignature.signature();
        const payload = coseSignature.payload();
        
        // Convert to CSL types
        const ed25519Sig = CSL.Ed25519Signature.from_bytes(signatureValue);
        
        // Verify the signature
        const isValid = publicKey.verify(signedData, ed25519Sig);
        
        verificationResults['cip8-cose'] = { 
          valid: isValid,
          ...(payload ? { payload: payload.toString('utf8').substring(0, 50) + '...' } : {})
        };
      } catch (error) {
        console.error("Error during CIP-8 COSE verification:", error);
        verificationResults['cip8-cose'] = { 
          valid: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
      
      // Test with legacy verification methods
      try {
        // For legacy verification, we need exactly 64 bytes signature
        let signatureToUse = sigBytes;
        
        if (sigBytes.length !== 64) {
          if (sigBytes.length === 70) {
            // Some wallets wrap in a CBOR structure that adds 6 bytes
            signatureToUse = sigBytes.slice(3, 67);
          } else if (sigBytes.length === 72) {
            // Some CBOR structures have different formats
            signatureToUse = sigBytes.slice(4, 68);
          } else if (sigBytes.length > 64) {
            // If all else fails, just try the last 64 bytes
            signatureToUse = sigBytes.slice(sigBytes.length - 64);
          }
        }
        
        const ed25519Sig = CSL.Ed25519Signature.from_bytes(signatureToUse);
        
        // Try verification with each message format
        Object.entries(messageFormats).forEach(([format, msgBytes]) => {
          if (!msgBytes) {
            verificationResults[`legacy-${format}`] = { valid: false, error: 'Invalid format' };
            return;
          }
          
          try {
            const isValid = publicKey.verify(msgBytes, ed25519Sig);
            verificationResults[`legacy-${format}`] = { valid: isValid };
          } catch (e) {
            verificationResults[`legacy-${format}`] = { 
              valid: false, 
              error: e instanceof Error ? e.message : String(e) 
            };
          }
        });
      } catch (e) {
        console.error("Error during legacy verification:", e);
      }
      
    } catch (e) {
      return NextResponse.json({
        error: 'Verification error',
        message: e instanceof Error ? e.message : String(e),
        inputs: {
          publicKeyLength: pubKeyBytes.length,
          signatureLength: sigBytes.length,
          messageLength: message.length
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      debug: true,
      inputs: {
        stakeAddress: stakeAddress || 'not provided',
        pubKey: pubKey.substring(0, 10) + '...',
        signature: signature.substring(0, 10) + '...',
        message: message.substring(0, 30) + '...',
        pubKeyBytes: pubKeyBytes.length,
        sigBytes: sigBytes.length
      },
      verificationResults
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Request error',
      message: err instanceof Error ? err.message : String(err)
    }, { status: 400 });
  }
} 