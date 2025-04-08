CIP-8 Implementation Summary

## Created Utilities
- Created custom COSE signature decoder in src/utils/decodeCardanoSignature.ts
- Implemented proper CIP-8 verification in src/app/api/user/verify/route.ts
- Updated debug endpoint in src/app/api/user/verify-debug/route.ts
- Modified frontend to send correct signature format in src/contexts/WalletIdentityContext.tsx

## Key Improvements
- Proper handling of COSE_Sign1 structures per CIP-8
- Extraction of public keys from COSE_Key format
- Verification against the exact signed data structure
- Fallback to legacy verification methods
- Better error handling and debugging

## How It Works
1. Frontend sends the raw signature from wallet (no normalization)
2. Backend detects CIP-8 structure and extracts signed data + signature
3. Public key is extracted from COSE_Key if applicable
4. Verification is performed against the exact bytes that were signed
5. Fallback methods ensure backward compatibility

This implementation is now fully compliant with the CIP-8 Cardano Message Signing standard.
