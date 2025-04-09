import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/utils/verifySignature';

/**
 * Simple test endpoint to verify signature verification works with minimal data
 * This helps isolate issues with the verification process
 */
export async function POST(req: NextRequest) {
  try {
    const { pubKey, signature, message, rawMessage } = await req.json();

    // Log all inputs for debugging
    console.log('Verify-Test received:', {
      pubKeyLength: pubKey?.length || 0,
      signatureLength: signature?.length || 0,
      messageLength: message?.length || 0,
      rawMessageLength: rawMessage?.length || 0
    });

    // Method 1: Verify using hex-encoded message (how it should work in production)
    let hexVerificationResult = false;
    let rawVerificationResult = false;
    
    try {
      const messageBytes = Buffer.from(message, 'hex');
      console.log('Method 1 - Hex message bytes:', {
        inputLength: message.length,
        bytesLength: messageBytes.length,
        preview: messageBytes.toString('utf8').substring(0, 30) + '...'
      });
      hexVerificationResult = verifySignature(pubKey, signature, messageBytes);
    } catch (error) {
      console.error('Method 1 error:', error);
    }

    // Method 2: Verify using raw message directly (for comparison)
    try {
      if (rawMessage) {
        const rawMessageBytes = Buffer.from(rawMessage, 'utf8');
        console.log('Method 2 - Raw message bytes:', {
          inputLength: rawMessage.length,
          bytesLength: rawMessageBytes.length,
          preview: rawMessage.substring(0, 30) + '...'
        });
        rawVerificationResult = verifySignature(pubKey, signature, rawMessageBytes);
      }
    } catch (error) {
      console.error('Method 2 error:', error);
    }
    
    // Return the results of both methods for comparison
    return NextResponse.json({
      success: true,
      results: {
        hexVerification: hexVerificationResult,
        rawVerification: rawVerificationResult
      }
    });
    
  } catch (error) {
    console.error('Error in verify-test endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 