import * as cbor from 'cbor';

export function extractRawPublicKeyHexSync(cborOrRawHex: string): string {
  try {
    const decoded = cbor.decodeFirstSync(Buffer.from(cborOrRawHex, 'hex'));
    let rawKey;

    if (Array.isArray(decoded)) rawKey = decoded[4];
    else if (decoded?.get?.(-2)) rawKey = decoded.get(-2);

    if (!rawKey || !Buffer.isBuffer(rawKey) || rawKey.length !== 32) {
      throw new Error("Invalid CBOR public key format");
    }

    return rawKey.toString('hex');
  } catch (_) {
    const rawKey = Buffer.from(cborOrRawHex, 'hex');
    if (rawKey.length !== 32) throw new Error("Invalid raw public key size");
    return rawKey.toString('hex');
  }
} 