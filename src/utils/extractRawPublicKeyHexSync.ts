import { PublicKey } from '@emurgo/cardano-serialization-lib-asmjs';

/**
 * A synchronous version of public key extraction that doesn't rely on CBOR
 * This should be used as a fallback when the async version fails
 */
export function extractRawPublicKeyHexSync(keyHex: string): string {
  try {
    // Check if it's already the right format (32 bytes / 64 hex chars)
    if (keyHex.length === 64) {
      const buffer = Buffer.from(keyHex, 'hex');
      if (buffer.length === 32) {
        return keyHex;
      }
    }
    
    // Try to convert from bytes
    const keyBytes = Buffer.from(keyHex, 'hex');
    
    // If it's already 32 bytes, that's our key
    if (keyBytes.length === 32) {
      return keyBytes.toString('hex');
    }
    
    // Try with PublicKey class
    const pubKey = PublicKey.from_bytes(keyBytes);
    return Buffer.from(pubKey.as_bytes()).toString('hex');
  } catch (error) {
    console.error("❌ Sync key extraction failed:", error);
    throw new Error(`Failed to extract public key: ${error instanceof Error ? error.message : String(error)}`);
  }
} 