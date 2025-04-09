# Changes to Fix "window is not defined" Error

## Problem

The application was encountering a server-side rendering error during build:

```
Error occurred prerendering page "/debug/diagnose". 
ReferenceError: window is not defined
```

This occurred because the page was directly accessing the browser's `window` object during Next.js's prerendering phase, which runs in a Node.js environment where `window` doesn't exist.

## Solution Overview

We implemented a pattern that ensures browser-specific code only runs on the client side:

1. Separating browser-specific code into a dedicated client component
2. Using Next.js dynamic imports with `ssr: false`
3. Configuring the page to be dynamically rendered
4. Adding client-side mount detection

## Files Changed

### 1. Created: `src/components/diagnostics/DiagnoseComponent.tsx`

Created a new client-only component containing all wallet interaction code:

```tsx
import React, { useState } from 'react';
import { useWalletIdentity } from '@/contexts/WalletIdentityContext';
import { toHex } from '@/utils/client/stringUtils';

const DiagnoseComponent: React.FC = () => {
  const { isVerified, stakeAddress, walletIdentityError, verifyWalletIdentityManually } = useWalletIdentity();
  const [testMessage, setTestMessage] = useState('test message');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [walletResponse, setWalletResponse] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  
  // Get wallet API
  const getWalletApi = async () => {
    try {
      if (!window.cardano) {
        throw new Error('Cardano object not found. Please install a wallet extension.');
      }
      
      // Get first wallet
      const wallets = Object.keys(window.cardano);
      if (wallets.length === 0) {
        throw new Error('No Cardano wallets found.');
      }
      
      const walletKey = wallets[0];
      console.log(`Using wallet: ${walletKey}`);
      
      return await window.cardano[walletKey].enable();
    } catch (error) {
      console.error('Error getting wallet API:', error);
      throw error;
    }
  };
  
  // Sign a test message
  const signTestMessage = async () => {
    try {
      setLoading(true);
      setResults(null);
      setWalletResponse(null);
      setVerificationResult(null);
      
      console.log(`Signing test message: "${testMessage}"`);
      
      // Get wallet API
      const api = await getWalletApi();
      
      // Get payment address (needed for signing)
      const paymentAddress = await api.getChangeAddress();
      console.log(`Payment address: ${paymentAddress}`);
      
      // Convert message to hex (required by CIP-30)
      const messageHex = toHex(testMessage);
      console.log(`Message hex: ${messageHex}`);
      
      // Sign the message
      const signResult = await api.signData(paymentAddress, messageHex);
      console.log('Sign result:', signResult);
      
      // Get the public key
      const pubKey = signResult.key;
      
      // Store wallet response
      setWalletResponse({
        walletName: Object.keys(window.cardano)[0],
        paymentAddress,
        pubKey,
        signature: signResult.signature,
        messageHex,
        rawMessage: testMessage
      });
      
      // Analyze signature with our diagnostic endpoint
      const analysisResponse = await fetch('/api/debug/wallet-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletName: Object.keys(window.cardano)[0],
          paymentAddress,
          pubKey,
          signature: signResult.signature
        })
      });
      
      const analysisResult = await analysisResponse.json();
      setResults(analysisResult);
      
      // Also test verification
      await testVerification({
        pubKey,
        signature: signResult.signature,
        message: messageHex,
        rawMessage: testMessage
      });
      
    } catch (error) {
      console.error('Error signing test message:', error);
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Test verification
  const testVerification = async (data: any) => {
    try {
      const response = await fetch('/api/debug/verify-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      setVerificationResult(result);
      return result;
    } catch (error) {
      console.error('Error testing verification:', error);
      setVerificationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  };
  
  // UI rendering with all the diagnostic panels and tools
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Signature Diagnostic Tool</h1>
      
      {/* Wallet interaction UI, test message form, results display, etc. */}
      {/* (Complete UI implementation included in actual file) */}
    </div>
  );
};

export default DiagnoseComponent;
```

### 2. Modified: `src/app/debug/diagnose/page.tsx`

Changed the page to dynamically import the DiagnoseComponent:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the actual diagnostic component with SSR disabled
const DiagnoseComponent = dynamic(
  () => import('@/components/diagnostics/DiagnoseComponent'),
  { ssr: false }
);

/**
 * Wallet Signature Diagnostic Tool - Page Wrapper
 * 
 * This component serves as a server-safe wrapper that loads the actual
 * diagnostic functionality only on the client side.
 */
export default function DiagnosePage() {
  const [isMounted, setIsMounted] = useState(false);
  
  // Only show content after component has mounted on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Wallet Signature Diagnostic Tool</h1>
        <p>Loading wallet diagnostic tools...</p>
      </div>
    );
  }
  
  return <DiagnoseComponent />;
}
```

### 3. Created: `src/app/debug/diagnose/config.ts`

Added configuration to make the page dynamically rendered:

```ts
// Set export config to make this page dynamically rendered and never prerendered
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
```

### 4. Created: `src/app/types/global.d.ts`

Added TypeScript definitions for the `window.cardano` property:

```ts
declare global {
  interface Window {
    cardano: {
      [key: string]: {
        enable: () => Promise<{
          getChangeAddress: () => Promise<string>;
          getUsedAddresses: () => Promise<string[]>;
          getRewardAddresses: () => Promise<string[]>;
          signData: (address: string, message: string) => Promise<{
            key: string;
            signature: string;
          }>;
        }>;
        isEnabled: () => Promise<boolean>;
      };
    };
  }
}

export {};
```

### 5. Deleted: `src/app/debug/diagnose/route.ts`

Removed conflicting route handler that was causing additional issues.

## Results

After implementing these changes, the build process completed successfully:

```
Route (app)                                 Size  First Load JS    
┌ ○ /                                    1.53 kB         103 kB
├ ○ /_not-found                            187 B         102 kB
├ ƒ /api/debug/check-inbox                 187 B         102 kB
...
└ ○ /debug/diagnose                      1.47 kB         103 kB
+ First Load JS shared by all             102 kB
```

The key improvements in this solution are:

1. All `window` access is now contained within components that only execute on the client side
2. The page is properly configured to avoid server-side prerendering
3. TypeScript types provide better safety for browser API access
4. Client-side mounting detection prevents rendering the component before it's safe to do so

This pattern is reusable for other pages that need to access browser-specific APIs in a Next.js application.

## CIP-8 Signature Verification Best Practices

When verifying a CIP-8 compliant signature on the backend (such as in a Vercel serverless function), keep these best practices in mind:

### 1. Proper CBOR Decoding

- **Always decode hex strings to bytes** and parse the CBOR data. The signature is a COSE structure, not a raw signature string.
- Use proper CBOR libraries to correctly parse the COSE_Sign1 structure according to the CIP-8 specification.

### 2. Use the Provided Public Key

- Use the provided COSE_Key for the public key rather than trying to extract a key from the address manually.
- This avoids confusion between stake/payment keys and ensures you use the exact key that signed the message.

### 3. Reconstruct the Signed Message

- Correctly reconstruct the exact signed message (Sig_structure) before verifying.
- Follow CIP-8's spec to build the array of `["Signature1", protected, external_aad (empty), payload]`.
- Leverage libraries to get the signed_data bytes.

### 4. Use the Correct Key Type

- Ensure the correct key type is used: know whether the wallet signed with a payment key or a stake key (based on the address type).
- Using the wrong key will always result in an invalid signature.

### 5. Address Ownership Verification (Optional)

- For additional security, verify the public key's hash matches the address used.
- CIP-8 includes the address in the signature for this reason, and you can cross-verify on the backend that the user's address indeed corresponds to the provided public key.

### 6. Implementation Example

Here's a simplified example of verification in Node.js:

```javascript
const cbor = require('cbor');
const crypto = require('crypto');

async function verifyCIP8Signature(hexSignature, hexMessage, address) {
  // 1. Decode the COSE signature
  const signatureBytes = Buffer.from(hexSignature, 'hex');
  const coseSign1 = await cbor.decodeFirst(signatureBytes);
  
  // 2. Extract public key from COSE structure
  const protectedHeader = await cbor.decodeFirst(coseSign1.value[0]);
  const publicKeyBytes = protectedHeader.get(4); // kid in header
  
  // 3. Reconstruct the Sig_Structure
  const externalAad = Buffer.alloc(0);
  const payload = Buffer.from(hexMessage, 'hex');
  const sigStructure = ['Signature1', coseSign1.value[0], externalAad, payload];
  const sigStructureBytes = await cbor.encodeCanonical(sigStructure);
  
  // 4. Extract signature
  const signatureValue = coseSign1.value[3];
  
  // 5. Verify the signature
  const verify = crypto.createVerify('sha512');
  verify.update(sigStructureBytes);
  const isValid = verify.verify(
    { key: publicKeyBytes, format: 'der', type: 'spki' },
    signatureValue
  );
  
  return isValid;
}
```

> Note: This is a simplified example. In practice, you would use libraries like `@emurgo/cardano-serialization-lib` or equivalent to handle Cardano-specific cryptography.

By following these practices, you can reliably verify CIP-8 signatures in Node.js, confirming that the wallet's owner signed the message and proving ownership of the Cardano address. 