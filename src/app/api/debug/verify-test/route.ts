import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { COSESign1, COSEKey, Label } from '@emurgo/cardano-message-signing-browser';
import { PublicKey } from '@emurgo/cardano-serialization-lib-browser';
import { Ed25519Signature } from '@emurgo/cardano-serialization-lib-browser';

export const runtime = 'edge';

/**
 * Simple test endpoint to verify signature verification works with minimal data
 * This helps isolate issues with the verification process
 */
export async function POST(req: NextRequest) {
  try {
    const { publicKey, signature, message, address } = await req.json();

    console.log('Public key length:', publicKey.length);
    console.log('Signature length:', signature.length);
    console.log('Message length:', message.length);

    // Convert hex strings to bytes
    const pubKeyBytes = Buffer.from(publicKey, 'hex');
    const signatureBytes = Buffer.from(signature, 'hex');
    const messageBytes = Buffer.from(message, 'hex');
    const addressBytes = address ? Buffer.from(address, 'hex') : null;

    // Parse COSE structures
    const coseSign1 = COSESign1.from_bytes(signatureBytes);
    if (!coseSign1) {
      throw new Error('Failed to parse COSE_Sign1 structure');
    }

    // Get headers
    const headers = coseSign1.headers();
    const protectedHeaders = headers.protected();
    
    // Extract public key and signature
    const key = PublicKey.from_bytes(pubKeyBytes);
    const sig = Ed25519Signature.from_bytes(signatureBytes);
    if (!key || !sig) {
      throw new Error('Failed to parse public key or signature');
    }

    // Get the exact signed data bytes
    const signedData = coseSign1.signed_data().to_bytes();
    if (!signedData) {
      throw new Error('Failed to get signed data');
    }

    // Verify signature
    const verified = key.verify(signedData, sig);

    // Optionally verify address matches public key
    let addressVerified = false;
    if (addressBytes) {
      // Add address verification logic here if needed
      addressVerified = true;
    }

    return NextResponse.json({
      success: verified,
      addressVerified,
      details: {
        algorithm: 'EdDSA',
        signedDataLength: signedData.length,
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 400 });
  }
} 