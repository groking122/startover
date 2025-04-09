import { NextRequest, NextResponse } from 'next/server';
import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import { verifySignature } from '@/utils/verifySignature';

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

    // Convert HEX message (signed by wallet) directly to a Buffer
    const messageBytes = Buffer.from(message, 'hex');

    console.log('Using original hex-encoded message bytes for verification:', {
      messageHexLength: message.length,
      messageBytesLength: messageBytes.length,
      messageHexPreview: message.substring(0, 30) + '...'
    });

    // Directly verify using bytes exactly as signed by wallet
    const isValidSignature = verifySignature(pubKey, signature, messageBytes);

    if (!isValidSignature) {
      console.log('❌ Signature verification failed');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid signature' 
        },
        { status: 400 }
      );
    }

    console.log('✅ Signature verified successfully');
    
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