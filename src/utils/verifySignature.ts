/**
 * Verify message signature using Emurgo Cardano Serialization Library (Ed25519)
 * This function verifies that a message was signed with the private key corresponding to the provided public key
 */
import {
  PublicKey,
  Ed25519Signature
} from '@emurgo/cardano-serialization-lib-asmjs';

/**
 * Verify a signature against a message using a public key
 * @param publicKeyHex The public key in hex format
 * @param signatureHex The signature in hex format
 * @param message The message that was signed (either original string or hex-encoded)
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(publicKeyHex: string, signatureHex: string, message: string): boolean {
  try {
    // Validate input sizes first
    const pubKeyBuffer = Buffer.from(publicKeyHex, 'hex');
    const sigBuffer = Buffer.from(signatureHex, 'hex');
    
    console.log("Verifying signature with:", {
      pubKeyHexLength: publicKeyHex.length,
      pubKeyByteLength: pubKeyBuffer.length,
      sigHexLength: signatureHex.length,
      sigByteLength: sigBuffer.length,
      messageLength: message.length,
      messagePreview: message.substring(0, 30) + "..."
    });
    
    // ED25519 public keys should be 32 bytes
    if (pubKeyBuffer.length !== 32) {
      console.error(`Invalid public key size: expected 32 bytes, got ${pubKeyBuffer.length} bytes`);
      return false;
    }
    
    // ED25519 signatures should be 64 bytes
    if (sigBuffer.length !== 64) {
      console.error(`Invalid signature size: expected 64 bytes, got ${sigBuffer.length} bytes`);
      return false;
    }
    
    // Parse the public key from hex
    const pubKey = PublicKey.from_hex(publicKeyHex);
    
    // Parse the signature from hex
    const sig = Ed25519Signature.from_hex(signatureHex);
    
    // For JSON messages, convert to string if it's an object
    const messageToVerify = typeof message === 'object' ? JSON.stringify(message) : message;
    
    // Convert message to buffer - Cardano wallets expect hex format for signing
    // If the message is already in hex format, we use it directly
    const messageBuffer = Buffer.from(messageToVerify, 'utf8');
    
    // Verify the signature
    const result = pubKey.verify(messageBuffer, sig);
    
    console.log(`Signature verification result: ${result ? 'Valid ✅' : 'Invalid ❌'}`);
    return result;
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
}

/**
 * Legacy version with different parameter order for backward compatibility
 * @deprecated Use the new parameter order instead
 */
export async function legacyVerifySignature(publicKeyHex: string, message: string, signatureHex: string): Promise<boolean> {
  return verifySignature(publicKeyHex, signatureHex, message);
} 