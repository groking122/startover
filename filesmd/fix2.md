Great — I’ll investigate why your wallet signature verification is failing, especially with CIP-8 signed messages (COSE format). I’ll review common pitfalls when verifying Cardano signatures in backend environments using the provided public key, message, and signature — including hex encoding, CBOR decoding, and common verification mismatches.

I’ll get back to you shortly with a clear explanation and a solution you can implement on the backend.

# Verifying Cardano CIP-8 Wallet Signatures on the Backend

## Understanding CIP-8 Signed Messages (COSE Signatures)

Cardano wallets (e.g. Eternl, Nami, Flint) implement **CIP-8** for message signing, meaning they return a COSE-encoded signature object when using the `signData` API. According to CIP-30 (the dApp-wallet Web Bridge spec), calling `api.signData(address, payload)` will use the wallet’s Ed25519 key to sign a CBOR/COSE structure ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=message%20to%20sign%20shown%20to,with%20the%20following%20headers%20set)) ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=The%20payload%20is%20not%20hashed,is%20used)). The wallet returns a **DataSignature** object containing: 

- `signature`: a **hex-encoded** CBOR **COSE_Sign1** object (the signed message structure) ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20request,with%20the%20following%20headers%20set)). 
- `key`: a **hex-encoded** CBOR **COSE_Key** (the public key and parameters) ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20request,with%20the%20following%20headers%20set)).

In other words, the signature is **not** a simple string or raw signature bytes – it’s a COSE Sign1 container encoded in CBOR (and then hex). The COSE structure embeds metadata such as the algorithm and the signing key’s associated address, per CIP-8. The wallet uses **Ed25519** (EdDSA) to sign, and includes an `alg: -8 (EdDSA)` header ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20,following%20headers%20set)). Crucially, the **address** used for signing is also included in the protected headers (as the raw address bytes) ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20,following%20headers%20set)), which CIP-8 recommends for verifying the public key–address relationship ([CIP-0008 | Message Signing](https://cips.cardano.org/cip/CIP-0008#:~:text=To%20resolve%20this%2C%20one%20SHOULD,with%20the%20verification%20public%20key)). The payload (message) is included as-is (not hashed) in the signed structure ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=The%20payload%20is%20not%20hashed,is%20used)).

**Why is this important?** To verify the signature on the backend, you must parse these CBOR/COSE hex strings properly and reconstruct exactly what was signed. Any mismatch in handling the encoding, key, or payload will cause verification failure.

## Common Pitfalls in Verifying COSE Signatures

When backend verification fails, it’s often due to one of these issues:

- **Hex vs Byte Misinterpretation:** The `signature` and `key` from `signData` are hex strings. You **must** convert them to bytes before processing. A common mistake is attempting to decode or verify the hex string directly. Always decode the hex to a byte array, then parse the CBOR structure from those bytes ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20request,with%20the%20following%20headers%20set)). For example, use `Buffer.from(signatureHex, "hex")` in Node.js to get the binary, then feed that to a CBOR decoder.

- **Improper CBOR Decoding or Usage:** The COSE signature (COSE_Sign1) is a CBOR-encoded array. You need to decode it to extract:
  1. The protected headers (a byte string which itself is CBOR data).
  2. The unprotected header map.
  3. The payload (the original message bytes, or `nil` if omitted).
  4. The signature bytes.  
  Failing to decode any layer correctly (e.g. forgetting to decode the protected header bytes into a map, or not handling the payload as bytes) will lead to verification errors. Use a CBOR library or Cardano’s serialization library to parse these. For instance, CIP-8’s structure means the actual signed bytes are a **Sig_structure** that includes the string `"Signature1"`, the protected header bytes, any external data (none in CIP-8), and the payload ([wallet - Implementing CIP-008 (signData function) in Java - Cardano Stack Exchange](https://cardano.stackexchange.com/questions/7791/implementing-cip-008-signdata-function-in-java#:~:text=%2F%2FCreate%20SignatureStructure,0%5D%29%29%3B%20sigStructArray.add%28messageToSignBS)). If you try to verify the signature against just the raw message (payload) alone, it will **fail** – you must verify against the COSE Sig_structure bytes that were actually signed.

- **Using the Wrong Public Key (Payment vs. Stake Key):** Cardano **addresses** can encode a payment key, a stake key, or both. The CIP-30 spec clarifies that if you pass a **base/enterprise/pointer address** to `signData`, the wallet will sign with the **payment key** for that address, whereas if you pass a **reward (stake) address**, it will sign with the **stake key** ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=message%20to%20sign%20shown%20to,with%20the%20following%20headers%20set)). A common mistake is assuming the wrong key. For example:
  - If the front-end used a stake address (`stake1...`) for `signData`, the signature was made with the stake private key. The backend must verify with the stake public key (not a payment key).
  - If a base address (`addr1...`) was used, the signature is from the payment key associated with that address (not the stake key component). Verifying with the stake key or wrong part will fail.  
  Ensure you use the correct public key corresponding to the address type that was signed. (The `key` returned by `signData` is already the correct pubkey in COSE_Key format, so use that rather than deriving from the address to avoid confusion.)

- **Mismatch Between Signed Data and Verified Data:** The content that gets signed includes the COSE structure overhead. In CIP-8, the wallet does **not hash** the payload or add additional data ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=The%20payload%20is%20not%20hashed,is%20used)), but the **context and headers are part of the signed bytes**. If you simply take the user’s message string and verify the signature against it, it won’t match. You need to reconstruct the exact byte string that was signed (the COSE Sig_structure). Most Cardano libraries provide a way to get this. For example, using the Cardano Serialization Lib or Message Signing lib, you can retrieve the `signed_data` bytes (which include the `"Signature1"` context, protected headers, and payload) that the signature covers. Always verify using those exact bytes and the signature.

- **Address and Public Key Misalignment:** The COSE signature embeds the address that the user provided (in the protected header) to identify which key was used ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20,following%20headers%20set)). It’s good practice to confirm that this address indeed corresponds to the public key that signed the message. In other words, derive the address (or the key hash) from the provided public key and see if it matches the address in the signature. If they don’t align, something is wrong (e.g. the wrong key was used or the signature is not from that address’s owner). CIP-8 addresses this by including the full address in the signed payload so the verifier can check the key-to-address mapping ([CIP-0008 | Message Signing](https://cips.cardano.org/cip/CIP-0008#:~:text=To%20resolve%20this%2C%20one%20SHOULD,with%20the%20verification%20public%20key)). On the backend, you might optionally verify that the bech32 address (stake or payment) constructed from the public key matches the address given. This is an extra safety check to prove ownership: the Cardano Foundation’s verification library even allows an optional address parameter for this purpose ([GitHub - cardano-foundation/cardano-verify-datasignature: A lightweight typescript library to verify a cip30 datasignature](https://github.com/cardano-foundation/cardano-verify-datasignature#:~:text=Furthermore%20an%20optional%20plain%20text,the%20signed%20message%20are%20equal)).

## Verifying a CIP-8 Signature in Node.js (Example)

Using Node.js, you can verify a CIP-8 signature with either specialized Cardano libraries or standard crypto libraries plus a CBOR parser. Below is a high-level example using the **Cardano Serialization Library** (and its companion message-signing module) for clarity:

```javascript
const { Buffer } = require("buffer");
// Use Cardano's serialization libs (make sure to install @emurgo/cardano-serialization-lib-nodejs and @emurgo/cardano-message-signing-nodejs)
const { COSESign1, COSEKey } = require("@emurgo/cardano-message-signing-nodejs");
const { PublicKey, Ed25519Signature, Address, RewardAddress, BaseAddress, StakeCredential } = require("@emurgo/cardano-serialization-lib-nodejs");

// Suppose we received these from the frontend:
const signatureHex = sigData.signature;  // hex string of COSE_Sign1
const keyHex = sigData.key;              // hex string of COSE_Key

// 1. Decode hex to bytes and parse the CBOR structures
const coseSign1 = COSESign1.from_bytes(Buffer.from(signatureHex, "hex"));
const coseKey   = COSEKey.from_bytes(Buffer.from(keyHex, "hex"));

// 2. Extract the public key bytes from COSE_Key (label -2 is the public key 'x')
const pubKeyLabel = -2;  // 'x' field
const pubKeyBytes = coseKey.header( /* Label -2 as an Int */ ).as_bytes(); 
// (In practice, use Label.new_int(-2) from the message-signing lib to get this header.)

// 3. Reconstruct the public key and signature objects
const publicKey = PublicKey.from_bytes(pubKeyBytes);
const signatureObj = Ed25519Signature.from_bytes( coseSign1.signature() );

// 4. Reconstruct the exact signed message bytes (COSE Sig_structure)
const signedDataBytes = coseSign1.signed_data().to_bytes(); 
// (This corresponds to the Sig_structure: ["Signature1", protectedHeaders, external_aad (empty), payload])

// 5. Verify the signature against the signed data
const isValid = publicKey.verify(signedDataBytes, signatureObj);
console.log("Signature valid?", isValid);
```

In the above example, the Cardano libraries handle much of the heavy lifting (parsing CBOR, reconstructing the signed bytes, etc.). The result `isValid` will be true if and only if the signature is correct for the message and key. Under the hood, this check ensures the Ed25519 signature was created by the corresponding private key ([GitHub - cardano-foundation/cardano-verify-datasignature: A lightweight typescript library to verify a cip30 datasignature](https://github.com/cardano-foundation/cardano-verify-datasignature#:~:text=What%20does%20it%20mean%20,verify%20a%20signature)).

**Verifying the Address (ownership):** You can additionally confirm that the public key corresponds to the original Cardano address used in `signData`. The address bytes are present in the COSE protected headers. For example:

```javascript
// Get address bytes from protected headers
const protectedHeaders = coseSign1.headers().protected().deserialized_headers();
const addrBytes = protectedHeaders.header(Address /* label "address" as Text or known label */).to_bytes();
// The `addrBytes` might have a prepend indicating length; adjust as needed (e.g., skip CBOR tag if present).

// Construct address object
const addr = Address.from_bytes(addrBytes);
const addrBech32 = addr.to_bech32(); 
console.log("Address from signature:", addrBech32);

// Derive address from public key (for comparison):
const keyHash = publicKey.hash(); // this gives the blake2b-224 hash of the public key
if (addr.is_reward()) {
    // If it's a reward (stake) address
    const networkId = addr.network_id();
    const derivedStakeAddr = RewardAddress.new(networkId, StakeCredential.from_keyhash(keyHash)).to_address();
    console.log("Derived stake address:", derivedStakeAddr.to_bech32());
} else if (addr.is_base() || addr.is_enterprise()) {
    // If it's a payment address (base or enterprise), compare the payment key hash
    const baseAddr = BaseAddress.from_address(addr);
    const paymentCredHash = baseAddr.payment_cred().to_keyhash();
    console.log("Payment key hash matches?", paymentCredHash.to_hex() === keyHash.to_hex());
    // (For a full base address match, you'd also need the stake cred hash which you may get from addr or user info if needed)
}
```

This allows you to ensure the public key indeed generates the same address (or has the same hash) that was signed. Typically, for a **stake address**, you expect an exact match, and for a **base address**, you at least expect the payment part to match the public key. The CIP-8 signature itself already ties the address to the signature (since the address is in the signed payload), but doing this check serverside can guard against any tampering or misuse.

## Summary and Best Practices

When verifying a CIP-8 compliant signature on the backend (such as in a Vercel serverless function), remember the following:

- **Always decode the hex strings to bytes and parse the CBOR.** The signature is a COSE structure, not a raw signature string ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=the%20request,with%20the%20following%20headers%20set)).
- **Use the provided COSE_Key for the public key**, rather than trying to extract a key from the address manually. This avoids confusion between stake/payment keys and ensures you use the exact key that signed the message.
- **Reconstruct the exact signed message (Sig_structure)** before verifying. Leverage libraries to get the `signed_data` bytes or follow CIP-8’s spec to build the array of `[ "Signature1", protected, external_aad (empty), payload ]`.
- **Ensure the correct key type is used**: know whether the wallet signed with a payment key or a stake key (based on the address type) ([CIP-30 | Cardano dApp-Wallet Web Bridge](https://cips.cardano.org/cip/CIP-30#:~:text=message%20to%20sign%20shown%20to,with%20the%20following%20headers%20set)). The wrong key = invalid signature.
- **Check address ownership (optional)**: for additional security, verify the public key’s hash matches the address used. CIP-8 includes the address in the signature for this reason ([CIP-0008 | Message Signing](https://cips.cardano.org/cip/CIP-0008#:~:text=To%20resolve%20this%2C%20one%20SHOULD,with%20the%20verification%20public%20key)), and you can cross-verify on the backend that the user’s address indeed corresponds to the provided public key.

By handling hex vs bytes properly, decoding the COSE/CBOR format, and using the correct verification key and message, you can reliably verify CIP-8 signatures in Node.js. This confirms that the wallet’s owner signed the message, proving ownership of the Cardano address ([GitHub - cardano-foundation/cardano-verify-datasignature: A lightweight typescript library to verify a cip30 datasignature](https://github.com/cardano-foundation/cardano-verify-datasignature#:~:text=What%20does%20it%20mean%20,verify%20a%20signature)), which is the goal of CIP-8 message signing. 

