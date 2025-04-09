export const extractRawPublicKeyHex = async (cborOrRawHex: string): Promise<string> => {
  try {
    // First try direct approach in case it's already a raw key
    if (cborOrRawHex.length === 64 || cborOrRawHex.length === 128) {
      // This looks like it might be a raw key already
      const rawBuffer = Buffer.from(cborOrRawHex, 'hex');
      if (rawBuffer.length === 32) {
        console.log("✅ Key appears to be raw format already");
        return cborOrRawHex;
      }
    }
    
    // Try to dynamically import CBOR library
    let cbor;
    try {
      cbor = await import('cbor');
    } catch (importError) {
      console.error("❌ Failed to import CBOR library:", importError);
      // Fallback to direct hex decoding if CBOR import fails
      const rawKey = Buffer.from(cborOrRawHex, 'hex');
      if (rawKey.length === 32) {
        return rawKey.toString('hex');
      }
      throw new Error("Failed to import CBOR and raw key is invalid");
    }

    try {
      const decoded = await cbor.decodeFirst(Buffer.from(cborOrRawHex, 'hex'));
      let rawKey;

      if (Array.isArray(decoded)) {
        // Try common array positions
        for (const index of [4, 0, decoded.length - 1]) {
          if (Buffer.isBuffer(decoded[index]) && decoded[index].length === 32) {
            rawKey = decoded[index];
            break;
          }
        }
      } 
      else if (decoded?.get && typeof decoded.get === 'function') {
        // Try common CBOR map keys
        for (const key of [-2, 2, 'key', 'publicKey']) {
          const val = decoded.get(key);
          if (Buffer.isBuffer(val) && val.length === 32) {
            rawKey = val;
            break;
          }
        }
      }
      else if (typeof decoded === 'object') {
        // Try object properties if it's not a CBOR map
        for (const key of ['publicKey', 'key', 'pk']) {
          if (Buffer.isBuffer(decoded[key]) && decoded[key].length === 32) {
            rawKey = decoded[key];
            break;
          }
        }
      }

      if (!rawKey || !Buffer.isBuffer(rawKey) || rawKey.length !== 32) {
        console.warn("❌ Could not extract key from CBOR structure:", 
          typeof decoded, Array.isArray(decoded) ? "array" : "");
        // Fallback: Try direct decoding
        const directKey = Buffer.from(cborOrRawHex, 'hex');
        if (directKey.length === 32) {
          return directKey.toString('hex');
        }
        throw new Error("Invalid CBOR public key format");
      }

      return rawKey.toString('hex');
    } catch (cborError) {
      console.error("❌ CBOR decoding failed:", cborError);
      
      // Fallback to direct approach
      const rawKey = Buffer.from(cborOrRawHex, 'hex');
      if (rawKey.length !== 32) {
        throw new Error(`Invalid raw public key size: ${rawKey.length} bytes (expected 32)`);
      }
      return rawKey.toString('hex');
    }
  } catch (error) {
    console.error("❌ Public key extraction completely failed:", error);
    throw new Error(`Failed to extract public key: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 