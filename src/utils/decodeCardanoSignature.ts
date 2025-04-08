import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';
import cbor from 'cbor';

// Simple implementation of COSESign1 functionality
export class COSESign1 {
  private _signedData: Buffer;
  private _signature: Buffer;
  private _payload?: Buffer;

  private constructor(signedData: Buffer, signature: Buffer, payload?: Buffer) {
    this._signedData = signedData;
    this._signature = signature;
    this._payload = payload;
  }

  public static from_bytes(bytes: Buffer): COSESign1 {
    try {
      // Decode CBOR structure - COSE_Sign1 is a CBOR array
      const decoded = cbor.decodeFirstSync(bytes);
      
      if (!Array.isArray(decoded)) {
        throw new Error('Expected CBOR array for COSE_Sign1');
      }
      
      // According to CIP-8/RFC8152:
      // COSE_Sign1 = [
      //   protected : bstr / {}, 
      //   unprotected : {},
      //   payload : bstr / nil,
      //   signature : bstr
      // ]
      
      if (decoded.length < 4) {
        throw new Error(`Invalid COSE_Sign1 structure: expected 4 elements, got ${decoded.length}`);
      }
      
      // Extract the signature (element 3)
      const signature = Buffer.isBuffer(decoded[3]) ? decoded[3] : Buffer.from([]);
      
      // Extract payload (element 2) - might be null in some implementations
      const payload = decoded[2] !== null && Buffer.isBuffer(decoded[2]) ? decoded[2] : undefined;
      
      // For signed_data, we need to reconstruct the Sig_structure per RFC8152 section 4.4
      // Sig_structure = [
      //   context : "Signature1",
      //   body_protected : bstr,
      //   external_aad : bstr,
      //   payload : bstr
      // ]
      const protectedHeader = Buffer.isBuffer(decoded[0]) ? decoded[0] : Buffer.from([]);
      
      // Construct Sig_structure for verification
      const sigStructure = cbor.encode([
        "Signature1", // context
        protectedHeader, // body_protected
        Buffer.from([]), // external_aad (empty)
        payload || Buffer.from([]) // payload
      ]);
      
      return new COSESign1(sigStructure, signature, payload);
    } catch (error) {
      console.error('Failed to decode COSE_Sign1:', error);
      throw error;
    }
  }

  public signed_data(): Buffer {
    return this._signedData;
  }

  public signature(): Buffer {
    return this._signature;
  }

  public payload(): Buffer | undefined {
    return this._payload;
  }
}

// Simple implementation of COSEKey functionality
export class COSEKey {
  private _map: Map<string | number, any>;

  private constructor(map: Map<string | number, any>) {
    this._map = map;
  }

  public static from_bytes(bytes: Buffer): COSEKey {
    try {
      // Decode CBOR structure - COSE_Key is a CBOR map
      const decoded = cbor.decodeFirstSync(bytes);
      
      if (typeof decoded !== 'object' || decoded === null) {
        throw new Error('Expected CBOR map for COSE_Key');
      }
      
      // Convert object to Map for better access
      const map = new Map(Object.entries(decoded));
      
      return new COSEKey(map);
    } catch (error) {
      console.error('Failed to decode COSE_Key:', error);
      throw error;
    }
  }

  public header(label: Label): any {
    // For simple label (e.g., direct integer access)
    if (typeof label === 'number') {
      return this._map.get(label);
    }
    
    // For Label object, extract the value
    const key = label.value();
    const value = this._map.get(key);
    
    if (Buffer.isBuffer(value)) {
      return value;
    }
    
    return value;
  }
}

// Simple Label implementation (for integer labels like -2)
export class Label {
  private _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static new_int(value: Int): Label {
    return new Label(value.value());
  }

  public value(): number {
    return this._value;
  }
}

// Simple Int implementation with negative number support
export class Int {
  private _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static new_negative(bigNum: CSL.BigNum): Int {
    const value = -parseInt(bigNum.to_str());
    return new Int(value);
  }

  public value(): number {
    return this._value;
  }
}

// Export a helper function to extract public key from a COSE_Key
export function extractPublicKeyFromCOSEKey(coseKeyBytes: Buffer): Buffer {
  const coseKey = COSEKey.from_bytes(coseKeyBytes);
  // In COSE, the label -2 corresponds to the public key (Ed25519 'x' coordinate)
  const label = Label.new_int(Int.new_negative(CSL.BigNum.from_str("2")));
  const rawKeyBytes = coseKey.header(label);
  
  if (!Buffer.isBuffer(rawKeyBytes)) {
    throw new Error('Public key not found in COSE_Key structure');
  }
  
  return rawKeyBytes;
} 