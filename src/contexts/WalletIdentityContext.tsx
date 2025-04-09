'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useReducer } from 'react';
// Don't import the cardano library directly at the top level
// import { useCardano } from '@cardano-foundation/cardano-connect-with-wallet';
import { PublicKey } from '@emurgo/cardano-serialization-lib-asmjs';
import { convertStakeAddressHexToBech32, getStakeAddressFromWallet } from '@/utils/client/stakeUtils';
import { extractRawPublicKeyHex } from '@/utils/extractRawPublicKeyHex';
import { extractRawPublicKeyHexSync } from '@/utils/extractRawPublicKeyHexSync';
import { getAvailableWallets, isWalletEnabled } from '@/utils/walletUtils';
// Import type for cbor module
import type * as CborModule from 'cbor';
import { toast } from 'react-hot-toast';
import { useCardano } from '@cardano-foundation/cardano-connect-with-wallet';
import { safeLocalStorage } from '@/utils/client/browserUtils';
import { toHex } from '@/utils/client/stringUtils';

interface WalletIdentityContextType {
  isWalletLoading: boolean;
  enabledWallet: string | null;
  cardanoEnabledWallet: string | null;
  stakeAddress: string | null;
  baseAddress: string | null;
  usedAddresses: string[];
  isVerified: boolean;
  walletIdentityError: string | null;
  refreshWalletIdentity: () => Promise<void>;
  disconnectWallet: () => void;
  verifyWalletIdentityManually: () => Promise<void>;
  refreshWalletIdentity: () => Promise<void>;
}

const WalletIdentityContext = createContext<WalletIdentityContextType>({
  isWalletLoading: false,
  enabledWallet: null,
  cardanoEnabledWallet: null,
  stakeAddress: null,
  baseAddress: null,
  usedAddresses: [],
  isVerified: false,
  walletIdentityError: null,
  refreshWalletIdentity: async () => {},
  disconnectWallet: () => {},
  verifyWalletIdentityManually: async () => {},
  refreshWalletIdentity: async () => {},
});

export const useWalletIdentity = () => useContext(WalletIdentityContext);

export const WalletIdentityProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [stakeAddress, setStakeAddress] = useState<string | null>(null);
  const [baseAddress, setBaseAddress] = useState<string | null>(null);
  const [usedAddresses, setUsedAddresses] = useState<string[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [walletIdentityError, setWalletIdentityError] = useState<string | null>(null);
  const [walletLocked, setWalletLocked] = useState(false);
  
  // Use state to hold wallet connection info
  const [isConnected, setIsConnected] = useState(false);
  const [enabledWallet, setEnabledWallet] = useState<string | null>(null);
  const [previousWallet, setPreviousWallet] = useState<string | null>(null);
  const [previousStakeAddress, setPreviousStakeAddress] = useState<string | null>(null);
  
  // Add a ref to track the previous verified stake address
  const verifiedStakeAddressRef = React.useRef<string | null>(null);
  // Add a new ref to always keep the latest stake address for reliable comparisons
  const latestStakeAddressRef = React.useRef<string | null>(null);

  // Get Cardano wallet state at the component level
  const { enabledWallet: cardanoEnabledWallet } = useCardano?.() || {};

  // Disconnect the wallet and reset related state
  const disconnectWallet = useCallback(() => {
    setStakeAddress(null);
    setUsedAddresses([]);
    setPreviousStakeAddress(null);
    setIsVerified(false);
    setIsConnected(false);
    setEnabledWallet(null);
    setPreviousWallet(null);
    verifiedStakeAddressRef.current = null;
    latestStakeAddressRef.current = null;
    setWalletLocked(false);
    
    // Clear any stored state in localStorage
    safeLocalStorage.removeItem('last_connected_stake_address');
    safeLocalStorage.removeItem("verifiedStakeAddress"); 
    safeLocalStorage.removeItem("verifiedPaymentAddress"); // Also clear payment address
    
    console.log("Wallet disconnected, all state reset");
    
    // Remove the aggressive page reload - let React state handle UI updates
    // If the user explicitly chooses to completely reset, offer a refresh button in the UI instead
  }, []);

  // Add a useEffect to handle verification persistence
  useEffect(() => {
    if (!stakeAddress) return;
    
    // Only reset verification if the address changed and it was previously verified
    if (verifiedStakeAddressRef.current && stakeAddress !== verifiedStakeAddressRef.current) {
      console.log("⚠️ Stake address changed from verified address, resetting verification status", {
        previousVerified: verifiedStakeAddressRef.current.substring(0, 10) + '...',
        new: stakeAddress.substring(0, 10) + '...'
      });
      setIsVerified(false);
    }
  }, [stakeAddress]);

  // Add a useEffect to restore verification state from localStorage when a wallet is connected
  useEffect(() => {
    if (!stakeAddress) return;
    
    const cached = safeLocalStorage.getItem("verifiedStakeAddress");
    if (cached && cached === stakeAddress) {
      setIsVerified(true);
      verifiedStakeAddressRef.current = cached;
      console.log("✅ Restored verification from cache");
    }
  }, [stakeAddress]);

  // Update the ref when verification succeeds
  useEffect(() => {
    if (isVerified && stakeAddress) {
      verifiedStakeAddressRef.current = stakeAddress;
      console.log("✅ Updated verified stake address reference:", 
        stakeAddress.substring(0, 10) + '...');
    }
  }, [isVerified, stakeAddress]);

  // Modified checkWalletConnection with gentler reconnect logic
  const checkWalletConnection = useCallback(async () => {
    // Skip wallet checking if there's no window object (SSR)
    if (typeof window === 'undefined' || !window.cardano) {
      return;
    }

    try {
      // Search for available wallets using our utility function
      const availableWallets = getAvailableWallets();
      
      console.log("Available wallets:", availableWallets);
      
      // Check if any wallet is enabled
      let walletKey = null;
      for (const key of availableWallets) {
        try {
          if (await isWalletEnabled(key)) {
            walletKey = key;
            break;
          }
        } catch (err) {
          console.error(`Error checking if wallet ${key} is enabled:`, err);
        }
      }
      
      // If we have a previously enabled wallet but can't find it now
      if (!walletKey && enabledWallet) {
        console.log("🔍 Previously connected wallet temporarily unavailable");
        
        // Try to gently reconnect instead of immediately disconnecting
        try {
          if (window.cardano[enabledWallet]) {
            console.log("🔌 Attempting to re-enable wallet:", enabledWallet);
            await window.cardano[enabledWallet].enable();
            
            // Check if it's now enabled after our attempt
            if (await isWalletEnabled(enabledWallet)) {
              console.log("✅ Successfully reconnected to wallet");
              walletKey = enabledWallet;
              setWalletLocked(false);
            } else {
              console.log("⚠️ Wallet is likely locked but not disconnected");
              setWalletLocked(true);
              return; // Keep existing state, don't disconnect
            }
          } else {
            console.log("⚠️ Wallet extension appears to be completely unavailable");
            setWalletLocked(true);
            return; // Keep existing state, don't disconnect
          }
        } catch (reconnectError) {
          console.log("⚠️ Failed to reconnect to wallet, but not disconnecting:", reconnectError);
          setWalletLocked(true);
          return; // Keep existing state, don't disconnect
        }
      } else if (walletKey && walletLocked) {
        // If we found a wallet and we previously thought it was locked, update state
        setWalletLocked(false);
      }
      
      // Crucial change: Only fetch stake address if wallet has actually changed!
      if (enabledWallet !== walletKey && walletKey) {
        console.log("🔍 Wallet changed or first detection, fetching stake address:", walletKey);
        
        // If wallet has changed, reset verification state
        if (enabledWallet && enabledWallet !== walletKey) {
          console.log("⚠️ Wallet changed from", enabledWallet, "to", walletKey, "- resetting verification state");
          setIsVerified(false);
          verifiedStakeAddressRef.current = null;
          // Don't clear latestStakeAddressRef yet - it will be updated by fetchStakeAddress
        }
        
        setEnabledWallet(walletKey);
        setPreviousWallet(walletKey);
        
        // Only fetch stake address when wallet changes or is newly detected
        await fetchStakeAddress(walletKey);
      } else if (enabledWallet === walletKey && latestStakeAddressRef.current && isVerified) {
        console.log("🔒 Wallet unchanged, verification preserved.");
        // Do nothing; verification remains stable
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
      // Don't reset state on error to prevent aggressive disconnects
      setWalletIdentityError(error instanceof Error ? error.message : String(error));
    }
  }, [enabledWallet, disconnectWallet, walletLocked, stakeAddress, isVerified]);

  // Safely get cardano wallet information using dynamic import and useEffect
  useEffect(() => {
    // Dynamically import cardano library to prevent SSR issues
    const initCardanoConnection = async () => {
      try {
        // Only run in browser environment
        if (typeof window === 'undefined') return;

        // Dynamically import the cardano library with error handling
        try {
          const cardanoModule = await import('@cardano-foundation/cardano-connect-with-wallet');
          const { useCardano } = cardanoModule;
          
          // Check if window.cardano exists
          if (!window.cardano) {
            console.warn('Cardano wallets not available');
            return;
          }
          
          // Initial connection check
          await checkWalletConnection();
          
          // Set up interval to periodically check wallet connection
          const connectionInterval = setInterval(() => {
            checkWalletConnection();
          }, 30000); // Check every 30 seconds
          
          // Clean up interval on unmount
          return () => clearInterval(connectionInterval);
        } catch (importError) {
          console.error('Error importing cardano library:', importError);
          return;
        }
      } catch (error) {
        console.error('Error initializing cardano connection:', error);
      }
    };
    
    initCardanoConnection();
  }, [checkWalletConnection]);

  // Create a function to handle wallet identity verification
  const verifyWalletIdentity = async (baseAddr: string, api: any) => {
    try {
      // Get the payment address (more secure than using stake address)
      const paymentAddress = await api.getChangeAddress();
      console.log("📦 paymentAddress =", paymentAddress);
      
      if (!paymentAddress) {
        throw new Error("No payment address available");
      }

      // Get the first payment address (hex format)
      const paymentAddressHex = usedAddresses[0];
      
      // Create a message to sign - include the current timestamp and stake address
      const messageObject = {
        stakeAddress: stakeAddr,
        timestamp: new Date().toISOString(),
        action: 'verify_wallet'
      };
      
      // Serialize to JSON string
      const messageJson = JSON.stringify(messageObject);
      console.log("📝 Original JSON message:", messageJson);
      
      // Convert JSON string to HEX format as required by CIP-30
      const messageHex = toHex(messageJson);
      console.log("🔢 Converted HEX:", messageHex);
      
      // Sign the message with the payment address (using hex format)
      console.log("⏳ Requesting wallet to sign data...");
      console.log("📤 messageHex (signed by wallet):", messageHex);
      const result = await api.signData(paymentAddressHex, messageHex);
      console.log("✅ Received sign result from wallet:", {
        keyLength: result.key?.length || 0,
        signatureLength: result.signature?.length || 0,
      });
      
      // Debug log: check the raw signature format
      console.log("🔍 Raw signature details:", {
        type: typeof result.signature,
        hexLength: result.signature?.length || 0,
        byteLength: Buffer.from(result.signature || "", 'hex').length,
        isValidHex: /^[0-9a-f]+$/i.test(result.signature || ""),
        preview: result.signature?.substring(0, 30) + "..."
      });
      
      // We'll use the original JSON for logging but send hex to the backend
      console.log("📝 Message for verification (JSON):", messageJson.substring(0, 30) + "...");
      
      // The public key from wallet may be CBOR encoded
      console.log("🔑 Raw wallet public key:", result.key);
      
      let publicKeyHex;
      
      try {
        // Try using the extractRawPublicKeyHex utility
        try {
          publicKeyHex = await extractRawPublicKeyHex(result.key);
          console.log("✅ Extracted raw public key hex:", publicKeyHex);
        } catch (utilError) {
          console.error("❌ Async utility extraction failed:", utilError);
          
          // Fallback: Try synchronous extraction if async fails (avoids CBOR issues)
          try {
            console.log("⚠️ Falling back to synchronous key extraction...");
            publicKeyHex = extractRawPublicKeyHexSync(result.key);
            console.log("✅ Extracted key using synchronous method");
          } catch (syncError) {
            console.error("❌ Sync extraction failed:", syncError);
            
            // Last resort fallback: Manual extraction if both utilities fail
            console.log("⚠️ Trying last resort manual extraction...");
            
            // Direct approach - try to convert directly from hex
            const rawKeyBuffer = Buffer.from(result.key, 'hex');
            
            if (rawKeyBuffer.length === 32) {
              // This is already a raw 32-byte key
              publicKeyHex = result.key;
              console.log("✅ Key was already in raw format");
            } 
            // If it's not 32 bytes, try with PublicKey class
            else {
              try {
                const pubKey = PublicKey.from_bytes(rawKeyBuffer);
                publicKeyHex = Buffer.from(pubKey.as_bytes()).toString('hex');
                console.log("✅ Extracted key using PublicKey class");
              } catch (keyError) {
                console.error("❌ All key extraction methods failed");
                throw new Error("Could not extract a valid 32-byte public key");
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Failed to extract public key:", error);
        throw new Error("Could not extract a valid 32-byte public key");
      }
      
      // Extract the raw signature from CBOR
      let rawSignatureHex = result.signature;
      console.log("📊 Original signature format:", {
        type: typeof result.signature,
        length: result.signature?.length || 0,
        hex: result.signature?.substring(0, 30) + "...",
      });
      
      try {
        // Dynamically import cbor library to avoid SSR issues
        const cbor = await import('cbor');
        
        // Try to decode as CBOR first
        try {
          const decoded = await cbor.decodeFirst(Buffer.from(result.signature, 'hex'));
          console.log("🔍 Decoded signature CBOR structure:", decoded);
          
          // Handle potential formats
          if (decoded) {
            if (typeof decoded === 'object') {
              // Object with signature property (CIP-8/CIP-30)
              if (decoded.signature && typeof decoded.signature === 'string') {
                console.log("✅ Found signature as string property:", decoded.signature.substring(0, 20) + "...");
                rawSignatureHex = decoded.signature;
              } 
              // Format with buffer directly
              else if (decoded.signature && Buffer.isBuffer(decoded.signature)) {
                console.log("✅ Found signature as buffer property");
                rawSignatureHex = decoded.signature.toString('hex');
              }
              // Some wallets might have a 'data' property
              else if (decoded.data && typeof decoded.data === 'string') {
                console.log("✅ Found signature as data property:", decoded.data.substring(0, 20) + "...");
                rawSignatureHex = decoded.data;
              }
              // Some wallets use numeric indices
              else if (Array.isArray(decoded) && decoded.length > 0) {
                // Try common index patterns
                const potentialSig = decoded[0] || decoded[1] || decoded[decoded.length - 1];
                if (typeof potentialSig === 'string') {
                  console.log("✅ Found signature in array at index:", decoded.indexOf(potentialSig));
                  rawSignatureHex = potentialSig;
                } else if (Buffer.isBuffer(potentialSig)) {
                  console.log("✅ Found signature buffer in array");
                  rawSignatureHex = potentialSig.toString('hex');
                }
              }
              // Last resort - serialize the whole object and log it
              else {
                console.warn("⚠️ Complex CBOR object structure:", JSON.stringify(decoded));
                
                // Try to extract any string that looks like a hex signature
                const objStr = JSON.stringify(decoded);
                const hexMatches = objStr.match(/[0-9a-f]{120,128}/);
                if (hexMatches && hexMatches[0]) {
                  console.log("✅ Found potential signature by pattern matching:", hexMatches[0].substring(0, 20) + "...");
                  rawSignatureHex = hexMatches[0];
                }
              }
            } 
            // Direct buffer
            else if (Buffer.isBuffer(decoded)) {
              console.log("✅ Decoded to direct buffer");
              rawSignatureHex = decoded.toString('hex');
            }
            // Direct string
            else if (typeof decoded === 'string') {
              console.log("✅ Decoded to direct string");
              rawSignatureHex = decoded;
            }
          }
        } catch (cborError) {
          console.warn("⚠️ CBOR decoding failed:", cborError);
          
          // If CBOR fails, maybe it's already a raw signature
          if (result.signature.length === 128 || result.signature.length === 64) {
            console.log("✅ Signature seems to be already in raw format");
            rawSignatureHex = result.signature;
          } else {
            console.error("❌ Unknown signature format and CBOR decoding failed");
          }
        }
      } catch (err) {
        console.error("❌ Failed to import or process with CBOR:", err);
        // Fallback to raw signature as a last resort
        rawSignatureHex = result.signature;
      }
      
      console.log("✅ Extracted raw signature hex:", rawSignatureHex.substring(0, 20) + "...");
      console.log("✅ Signature length:", rawSignatureHex.length, "characters (should be ~128)");
      
      // Normalize signature to ensure it's exactly 64 bytes
      const normalizedSignature = await normalizeEd25519Signature(rawSignatureHex);
      console.log("✅ Normalized signature length:", normalizedSignature.length, 
        "characters =", Buffer.from(normalizedSignature, 'hex').length, "bytes");
      
      // Explicitly verify normalized signature before sending to backend
      console.log("Normalized signature (frontend):", {
        length: normalizedSignature.length,
        bytes: Buffer.from(normalizedSignature, 'hex').length,
        preview: normalizedSignature.substring(0, 30) + "..."
      });
      
      console.log("🔑 Final public key hex:", publicKeyHex);
      console.log("🔢 Payload sizes:", {
        stakeAddress: stakeAddr.length,
        publicKey: publicKeyHex.length,
        rawSignature: rawSignatureHex.length,
        normalizedSignature: normalizedSignature.length,
        message: message.length,
      });

      // Run a debug check first to diagnose any issues
      let bestVerificationMethod = "";
      try {
        console.log("🔍 Running verification debug check...");
        const debugResponse = await fetch('/api/user/verify-debug', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            stakeAddress: stakeAddr,
            publicKey: publicKeyHex,
            signature: normalizedSignature,
            message
          }),
        });
        
        const debugResult = await debugResponse.json();
        console.log("📊 Debug verification results:", debugResult);
        
        // Find which verification method succeeded
        const verificationResults = debugResult.verificationResults || {};
        for (const [method, result] of Object.entries(verificationResults)) {
          // Type check to avoid TypeScript errors
          if (result && typeof result === 'object' && 'valid' in result && result.valid === true) {
            bestVerificationMethod = method;
            console.log(`✅ Found working verification method: ${method}`);
            break;
          }
        }
          
        if (bestVerificationMethod) {
          console.log("✅ Debug verification found a valid combination!");
        } else {
          console.warn("⚠️ Debug verification failed to find a valid combination");
        }
      } catch (debugError) {
        console.error("❌ Debug verification error:", debugError);
      }

      // Make actual API call to validate the signature with the best method found
      console.log("📤 Making actual verification request");
      const apiUrl = bestVerificationMethod 
        ? `/api/user/verify?method=${bestVerificationMethod}&stakeAddress=${encodeURIComponent(stakeAddr)}` 
        : `/api/user/verify?stakeAddress=${encodeURIComponent(stakeAddr)}`;
        
      // Log the exact payload being sent to the API
      console.log("📦 Verification API payload:", {
        stakeAddress: stakeAddr.substring(0, 10) + "...",
        pubKeyLength: publicKeyHex.length,
        signatureLength: normalizedSignature.length,
        messageLength: messageHex.length,
        messageFirst20Chars: messageHex.substring(0, 20) + "...",
        apiUrl
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          stakeAddress: stakeAddr,
          pubKey: publicKeyHex,
          signature: normalizedSignature,
          message: messageHex // Send the hex-encoded message that was signed
        }),
      });

      if (!response.ok) {
        console.error("❌ Response not OK:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries([...response.headers.entries()]),
        });
        
        // Clone the response first to avoid "body already read" errors
        const responseClone = response.clone();
        
        // Try to get the raw text first to see what's actually being returned
        const rawText = await responseClone.text();
        console.error("❌ Raw response text:", rawText);
        
        let errorJson: any;
        try {
          // Now try to parse it as JSON
          if (rawText.trim()) {
            errorJson = JSON.parse(rawText);
          } else {
            errorJson = { error: "Empty response from server" };
          }
        } catch (parseError) {
          console.error("❌ Failed to parse error JSON:", parseError);
          errorJson = { 
            error: "Invalid JSON response from server",
            rawText: rawText.substring(0, 100) + (rawText.length > 100 ? '...' : '')
          };
        }

        console.error("❌ Verification API error:", {
          status: response.status,
          error: errorJson.error,
          detail: errorJson.detail,
          stack: errorJson.stack,
          raw: errorJson
        });

        throw new Error(`Verification failed: ${errorJson.error || response.statusText || "Unknown error"}`);
      }

      const verifyResult = await response.json();
      console.log("✅ Verification result:", verifyResult);
      
      // Update verification status based on API response (check verified field from response)
      if (verifyResult.verified) {
      setIsVerified(true);
        verifiedStakeAddressRef.current = stakeAddr;
        localStorage.setItem("verifiedStakeAddress", stakeAddr); // Store it for persistence
        console.log("✅ Verified at:", new Date().toISOString());
      } else {
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        // Clear any existing verification data
        safeLocalStorage.removeItem("verifiedStakeAddress");
        console.error("❌ Server returned success but verification status is not true");
      }
      
      return verifyResult;
    } catch (error) {
      console.error("❌ Wallet verification error:", error);
      setIsVerified(false);
      verifiedStakeAddressRef.current = null;
      throw error;
    }
  };

  // Add a helper function for retrying fetch operations
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Fetch attempt ${i + 1}/${maxRetries} for ${url}`);
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        console.error(`Fetch attempt ${i + 1} failed:`, error);
        lastError = error;
        
        // Don't wait on the last attempt
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          // Increase delay for next retry (exponential backoff)
          delay *= 1.5;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  };

  // Function to get the stake address
  const fetchStakeAddress = async (walletKey: string) => {
    try {
      setIsWalletLoading(true);
      
      console.log("Fetching stake address for wallet:", walletKey);
      
      // Get stake address directly from wallet (preferred method)
      const directStakeAddress = await getStakeAddressFromWallet(walletKey);
      
      if (directStakeAddress) {
        console.log("✅ Got stake address directly from wallet:", directStakeAddress.substring(0, 10) + "...");
        setStakeAddress(directStakeAddress);
        setIsVerified(false); // Still need to verify
        return;
      }
      
      // Fallback to traditional method if direct access fails
      console.log("Direct wallet access failed, falling back to traditional method");
      
      // Enable the wallet and get its API
      if (!window.cardano || !window.cardano[walletKey]) {
        throw new Error(`Wallet ${walletKey} not available`);
      }
      
      const api = await window.cardano[walletKey].enable();
      console.log("📦 api =", api);
      
      // Get the first used address (payment address)
      const usedAddresses = await api.getUsedAddresses();
      console.log("📦 usedAddresses =", usedAddresses);
      
      if (!usedAddresses || usedAddresses.length === 0) {
        throw new Error("No addresses found in the wallet");
      }
      
      // Store the used addresses in state
      setUsedAddresses(usedAddresses);
      
      const baseAddressHex = usedAddresses[0];
      
      // Convert hex to bech32 format
      try {
        // Import Address from Cardano serialization lib
        const { Address } = await import('@emurgo/cardano-serialization-lib-asmjs');
        const baseAddress = Address.from_bytes(Buffer.from(baseAddressHex, 'hex')).to_bech32();
        console.log("🧪 Converted base address:", baseAddress);
        
        // Store the base address in state
        setStakeAddress(baseAddress);
        setBaseAddress(baseAddress);
        setIsVerified(false); // Need to verify first
      } catch (error) {
        console.error("❌ Failed to convert base address to bech32:", error);
        setStakeAddress(null);
        setBaseAddress(null);
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        return;
      }
      
      const stakeAddrHex = rewardAddresses[0];
      console.log("✅ Got stake address hex:", stakeAddrHex?.substring(0, 10) + '...');
      
      // Convert hex to bech32 format using our utility function
      const stakeAddrBech32 = await convertStakeAddressHexToBech32(stakeAddrHex);
      console.log("🧪 Converted address about to be stored:", stakeAddrBech32);
      
      // Validate bech32 address
      if (!stakeAddrBech32) {
        console.error("❌ Failed to convert stake address to bech32");
        setStakeAddress(null);
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        return;
      }
      
      // Store the stake address in state
      setStakeAddress(stakeAddrBech32);
      setIsVerified(false); // Need to verify first
    } catch (error) {
      console.error("Error fetching addresses:", error);
      setStakeAddress(null);
      setBaseAddress(null);
      setIsVerified(false);
      verifiedStakeAddressRef.current = null;
      latestStakeAddressRef.current = null;
    } finally {
      setIsWalletLoading(false);
    }
  };

  // Refresh wallet identity data
  const refreshWalletIdentity = async () => {
    if (enabledWallet) {
      await fetchStakeAddress(enabledWallet);
    } else {
      // If no enabled wallet, check connections
      await checkWalletConnection();
    }
  };

  const verifyWalletIdentityManually = async () => {
    console.log("🔐 Manual wallet verification requested");
    
    // Don't proceed if wallet loading
    if (isWalletLoading) {
      console.warn("⚠️ Wallet is loading, cannot verify now");
      toast.error("Please wait for wallet to connect");
      return;
    }
    
    // Don't proceed if no wallet connection
    if (!stakeAddress) {
      console.warn("⚠️ No wallet connected, cannot verify");
      toast.error("Please connect your wallet first");
      return;
    }
    
    try {
      setIsWalletLoading(true);
      setWalletIdentityError(null);
      toast.loading("Verifying wallet... Please approve the signature request in your wallet extension", { id: "verify" });
      
      // Check if we already have the wallet API from the context
      let api;
      try {
        // Use enabledWallet from the component level
        if (!cardanoEnabledWallet) {
          toast.error("Wallet not connected. Please connect first.", { id: "verify" });
          console.error("⚠️ No enabled wallet found");
          setWalletIdentityError("Wallet not connected");
          return;
        }
        
        api = await window.cardano[cardanoEnabledWallet].enable();
        
        if (!api) {
          toast.error("Unable to access wallet API", { id: "verify" });
          console.error("⚠️ Failed to get wallet API");
          setWalletIdentityError("Unable to access wallet API");
          return;
        }
      } catch (apiError) {
        console.error("❌ Error accessing wallet API:", apiError);
        toast.error(`Wallet access error: ${apiError instanceof Error ? apiError.message : 'Unknown'}`, { id: "verify" });
        setWalletIdentityError("Wallet access error");
        return;
      }
      
      try {
        // Verify the wallet identity using the utility function
        await verifyWalletIdentity(stakeAddress, api);
        
        toast.success("Wallet verified successfully! ✓", { id: "verify" });
        setIsVerified(true);
        verifiedStakeAddressRef.current = stakeAddress;
        latestStakeAddressRef.current = stakeAddress;
        
        // Get and store the payment address for future reference
        try {
          const paymentAddress = await api.getChangeAddress();
          if (paymentAddress) {
            // Store the payment address in localStorage for future security checks
            safeLocalStorage.setItem("verifiedPaymentAddress", paymentAddress);
            console.log("✅ Payment address stored for future verification:", 
              paymentAddress.substring(0, 10) + '...');
          }
        } catch (paymentError) {
          console.warn("⚠️ Could not store payment address:", paymentError);
        }
        
        // Store stake address in localStorage
        safeLocalStorage.setItem("verifiedStakeAddress", stakeAddress);
        console.log("✅ Verification completed at:", new Date().toISOString());
      } catch (verifyError: any) {
        console.error("❌ Verification error:", verifyError);
        
        // Clear verification state
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        // Don't clear the latestStakeAddressRef here to maintain address tracking
        
        // Handle user rejecting the signature request
        if (verifyError.message?.includes('user declined') || 
            verifyError.message?.includes('declined sign') || 
            verifyError.message?.includes('rejected')) {
          toast.error("You need to approve the signature request in your wallet to verify", { id: "verify" });
          setWalletIdentityError("Signature request was rejected");
        } else if (verifyError.message?.includes('timeout')) {
          toast.error("Verification timed out. Please try again", { id: "verify" });
          setWalletIdentityError("Verification timed out");
        } else {
          toast.error(`Verification failed: ${verifyError.message || 'Unknown error'}`, { id: "verify" });
          setWalletIdentityError(verifyError.message || "Verification failed");
        }
      }
    } catch (error) {
      console.error("❌ General verification error:", error);
      toast.error(`Verification error: ${error instanceof Error ? error.message : 'Unknown'}`, { id: "verify" });
      setWalletIdentityError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsWalletLoading(false);
    }
  };

  // Update the normalizeEd25519Signature function with proper CBOR decoding
  const normalizeEd25519Signature = async (sigHex: string): Promise<string> => {
    try {
      console.log("🔎 Starting signature normalization with raw signature:");
      console.log("📊 RAW INPUT SIGNATURE:", { 
        length: sigHex?.length || 0, 
        hexBytes: Buffer.from(sigHex || "", 'hex').length,
        rawPreview: sigHex?.substring(0, 40) + "...",
        isHex: /^[0-9a-f]+$/i.test(sigHex || "")
      });
      
      // Check for null/undefined
      if (!sigHex) {
        throw new Error("Received empty signature");
      }
      
      // Ensure it's a valid hex string first
      if (!/^[0-9a-f]+$/i.test(sigHex)) {
        console.warn("⚠️ Not a valid hex string, attempting to clean...");
        // Try to extract only hex characters
        const cleanedSig = sigHex.replace(/[^0-9a-f]/gi, '');
        
        if (!/^[0-9a-f]+$/i.test(cleanedSig)) {
          console.error("❌ Could not convert to valid hex string:", sigHex.substring(0, 50));
          throw new Error("Signature contains non-hex characters even after cleaning");
        }
        
        console.log("⚙️ Cleaned signature to valid hex:", cleanedSig.substring(0, 20) + "...");
        sigHex = cleanedSig;
      }
      
      // Show first 8 bytes of signature for debugging CBOR/COSE format
      const sigBuffer = Buffer.from(sigHex, 'hex');
      console.log("📊 Signature raw bytes at specific positions:", { 
        totalBytes: sigBuffer.length,
        first8Bytes: Array.from(sigBuffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        last8Bytes: Array.from(sigBuffer.slice(-8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });

      // IMPROVED: Better format detection for CBOR/COSE signatures
      const isCOSESign1 = sigBuffer[0] === 0x84; // COSE_Sign1 format
      const isEternlFormat = sigBuffer[0] === 0x82; // Eternl specific format
      
      console.log("📊 Signature format detection:", {
        isCOSESign1,
        isEternlFormat,
        firstByte: sigBuffer[0]?.toString(16),
        first4Bytes: sigBuffer.slice(0, 4).toString('hex'),
      });
      
      // If it's already a 64-byte signature, return it directly
      if (sigBuffer.length === 64) {
        console.log("✅ Signature is already the correct 64-byte format");
        return sigHex;
      }
      
      // CRITICAL IMPROVEMENT: Use explicit CBOR decoding for COSE structures
      const extractSignatureWithCbor = async (sigBuffer: Buffer): Promise<Buffer> => {
        try {
          // Dynamically import cbor
          const cbor = await import('cbor');
          console.log("🔍 Attempting CBOR decode of signature...");
          
          // Decode the CBOR structure
          const decoded = await cbor.decodeFirst(sigBuffer);
          console.log("🔍 Decoded CBOR structure:", decoded);
          
          // Handle different CBOR structures based on common wallet formats
          
          // COSE_Sign1 format: [protected, unprotected, payload, signature]
          if (Array.isArray(decoded) && decoded.length === 4 && Buffer.isBuffer(decoded[3])) {
            console.log("✅ Detected standard COSE_Sign1 structure, signature at index 3");
            const extractedSig = decoded[3];
            if (extractedSig.length !== 64) {
              console.warn(`⚠️ Extracted signature length is ${extractedSig.length} bytes, expected 64`);
            }
            return extractedSig;
          }
          
          // Eternl format often uses [headers, signature] structure
          if (Array.isArray(decoded) && decoded.length === 2 && Buffer.isBuffer(decoded[1])) {
            console.log("✅ Detected likely Eternl format, signature at index 1");
            const extractedSig = decoded[1];
            if (extractedSig.length !== 64) {
              console.warn(`⚠️ Extracted signature length is ${extractedSig.length} bytes, expected 64`);
            }
            return extractedSig;
          }
          
          // Some wallets wrap the signature in an object
          if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
            // Look for common signature property names
            const propNames = ['signature', 'data', 'value'];
            for (const prop of propNames) {
              if (decoded[prop] && Buffer.isBuffer(decoded[prop])) {
                console.log(`✅ Found signature in object property: ${prop}`);
                const extractedSig = decoded[prop];
                if (extractedSig.length !== 64) {
                  console.warn(`⚠️ Extracted signature length is ${extractedSig.length} bytes, expected 64`);
                }
                return extractedSig;
              }
            }
          }
          
          // If none of the above patterns match, throw error
          throw new Error("Could not locate 64-byte signature in CBOR structure");
        } catch (error) {
          console.error("❌ CBOR decoding failed:", error);
          throw error;
        }
      };
      
      // Handle signature extraction based on format
      try {
        // First try explicit CBOR decoding for COSE/CBOR signatures
        if (isCOSESign1 || isEternlFormat || sigBuffer[0] >= 0x80) { // CBOR major type 5-7
          try {
            const extracted = await extractSignatureWithCbor(sigBuffer);
            console.log("✅ Successfully extracted signature with CBOR:", {
              length: extracted.length,
              hex: extracted.toString('hex').substring(0, 30) + '...'
            });
            return extracted.toString('hex');
          } catch (cborError) {
            console.error("❌ CBOR extraction failed:", cborError);
            // Fall through to fallback methods
          }
        }
        
        // If CBOR extraction fails or format isn't CBOR, try common fixed offsets
        
        // Common 70-byte format (often signature at bytes 3-67)
        if (sigBuffer.length === 70) {
          console.log("🔍 Trying 70-byte format extraction (bytes 3-67)");
          const extracted = sigBuffer.slice(3, 67);
          if (extracted.length === 64) {
            console.log("✅ Successfully extracted 64 bytes from 70-byte format");
            return extracted.toString('hex');
          }
        }
        
        // Common 72-byte format (often signature at bytes 4-68)
        if (sigBuffer.length === 72) {
          console.log("🔍 Trying 72-byte format extraction (bytes 4-68)");
          const extracted = sigBuffer.slice(4, 68);
          if (extracted.length === 64) {
            console.log("✅ Successfully extracted 64 bytes from 72-byte format");
            return extracted.toString('hex');
          }
        }
        
        // Last resort: try to extract last 64 bytes
        console.log("🔍 Trying last resort: extract last 64 bytes");
        const lastResort = sigBuffer.slice(-64);
        if (lastResort.length === 64) {
          console.log("⚠️ Extracted signature using last resort method (last 64 bytes)");
          return lastResort.toString('hex');
        }
        
        throw new Error(`Could not extract a valid 64-byte signature from ${sigBuffer.length}-byte input`);
      } catch (extractError) {
        console.error("❌ All signature extraction methods failed:", extractError);
        throw new Error(`Failed to extract Ed25519 signature: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
      }
    } catch (error) {
      console.error("❌ Signature normalization error:", error);
      throw error;
    }
  };

  // Add or update the connectWallet function if it doesn't exist
  const connectWallet = async (walletKey: string) => {
    if (!walletKey) return;
    
    try {
      setIsWalletLoading(true);
      setWalletIdentityError(null);
      
      // Enable the wallet
      if (!window.cardano || !window.cardano[walletKey]) {
        throw new Error(`Wallet ${walletKey} not available`);
      }
      
      // Set the enabled wallet
      setEnabledWallet(walletKey);
      localStorage.setItem('lastConnectedWallet', walletKey);
      
      // Fetch addresses for the wallet
      await fetchStakeAddress(walletKey);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setWalletIdentityError(error instanceof Error ? error.message : "Unknown error connecting wallet");
    } finally {
      setIsWalletLoading(false);
    }
  };

  const value = {
    stakeAddress,
    usedAddresses,
    isVerified,
    isWalletLoading,
    walletIdentityError,
    refreshWalletIdentity,
    disconnectWallet,
    checkWalletConnection,
    verifyWalletIdentityManually,
  };

  return (
    <WalletIdentityContext.Provider value={value}>
      {children}
    </WalletIdentityContext.Provider>
  );
};
