import { NextRequest, NextResponse } from 'next/server';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import { verifySignature } from '@/utils/verifySignature';
import { fromHex } from '@/utils/client/stringUtils';

/**
 * API endpoint to verify a wallet signature using payment address
 * This provides stronger security by verifying the payment address matches the public key
 */
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { paymentAddress, stakeAddress, pubKey, signature, message } = body;

    if (!paymentAddress || !pubKey || !signature || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters',
        },
        { status: 400 }
      );
    }

    // Comprehensive logging of the incoming verification payload
    console.log("Incoming verification payload (backend):", {
      signatureLength: signature.length,
      signatureBytes: Buffer.from(signature, 'hex').length,
      signaturePreview: signature.substring(0, 30) + "...",
      messageLength: message.length,
      messagePreview: message.substring(0, 30) + "...",
      pubKeyLength: pubKey.length,
      pubKeyBytes: Buffer.from(pubKey, 'hex').length,
      pubKeyPreview: pubKey.substring(0, 30) + "...",
      paymentAddressPreview: paymentAddress.substring(0, 20) + "..."
    });

    // Enhanced signature validation
    console.log("Received signature data:", {
      signatureHexLength: signature.length,
      signatureByteLength: Buffer.from(signature, 'hex').length,
      pubKeyHexLength: pubKey.length,
      pubKeyByteLength: Buffer.from(pubKey, 'hex').length,
      messageHexLength: message.length,
    });

    // Validate signature size
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (signatureBuffer.length !== 64) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid signature size: expected 64 bytes, got ${signatureBuffer.length} bytes`,
          details: {
            signatureHexLength: signature.length,
            signatureByteLength: signatureBuffer.length,
            signatureHexPreview: signature.substring(0, 30) + '...',
          }
        },
        { status: 400 }
      );
    }

    // Step 1: Verify the signature is valid for the message using the public key
    try {
      // The message is already hex-encoded from frontend - use it directly
      const messageHex = message;
      const messageBytes = Buffer.from(messageHex, 'hex');
      
      console.log("Using original hex-encoded message bytes for verification:", {
        messageHexLength: messageHex.length,
        messageBytesLength: messageBytes.length,
        messageHexPreview: messageHex.substring(0, 30) + "..."
      });
      
      // Use our existing verification logic to check the signature with the hex bytes
      const isValidSignature = verifySignature(pubKey, signature, messageBytes);
      
      if (!isValidSignature) {
        console.log('❌ Signature verification failed');
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid signature',
          },
          { status: 400 }
        );
      }
      
      console.log('✅ Signature verified successfully');
    } catch (error) {
      console.error('Error verifying signature:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }

    // Step 2: Verify that the payment address matches the public key
    try {
      // Derive public key hash from the provided public key
      const publicKey = CSL.PublicKey.from_hex(pubKey);
      const derivedPubKeyHash = publicKey.hash().to_hex();
      
      // Parse the provided payment address
      const address = CSL.Address.from_bech32(paymentAddress);
      const baseAddress = CSL.BaseAddress.from_address(address);
      
      if (!baseAddress) {
        console.log('❌ Invalid payment address format');
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment address format',
          },
          { status: 400 }
        );
      }
      
      // Extract payment credential from address
      const paymentCred = baseAddress.payment_cred().to_keyhash();
      if (!paymentCred) {
        console.log('❌ Address lacks valid payment credential');
        return NextResponse.json(
          {
            success: false,
            error: 'Address lacks valid payment credential',
          },
          { status: 400 }
        );
      }
      
      const paymentCredHash = paymentCred.to_hex();
      
      // Verify that derived key matches provided address credential
      if (derivedPubKeyHash !== paymentCredHash) {
        console.log('❌ Payment credential mismatch');
        console.log('Derived pubkey hash:', derivedPubKeyHash);
        console.log('Payment cred hash:', paymentCredHash);
        return NextResponse.json(
          {
            success: false,
            error: 'Verification failed: payment credential mismatch',
          },
          { status: 400 }
        );
      }
      
      console.log('✅ Payment address verified successfully');
      
      // Save the verified address to your database here if needed
      // This is where you'd associate the stakeAddress with a user account
      
      return NextResponse.json({
        success: true,
        message: 'Wallet verification successful',
        verifiedAddress: paymentAddress,
        stakeAddress: stakeAddress // Return the stake address for reference
      });
    } catch (error) {
      console.error('Error verifying address:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Address verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('General verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
} 