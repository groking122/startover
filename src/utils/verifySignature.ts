/**
 * Verify message signature using Emurgo Cardano Serialization Library (Ed25519)
 * This function verifies that a message was signed with the private key corresponding to the provided public key
 */
import {
  PublicKey,
  Ed25519Signature
} from '@emurgo/cardano-serialization-lib-asmjs';

export async function verifySignature(publicKeyHex: string, message: string, signatureHex: string): Promise<boolean> {
  try {
    const pubKey = PublicKey.from_hex(publicKeyHex);
    const sig = Ed25519Signature.from_hex(signatureHex);
    const msg = Buffer.from(message, 'utf8');
    
    return pubKey.verify(msg, sig);
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
} 