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

interface WalletIdentityContextType {
  stakeAddress: string | null;
  usedAddresses: string[] | null;
  isVerified: boolean;
  isWalletLoading: boolean;
  walletIdentityError: string | null;
  walletLocked: boolean;
  refreshWalletIdentity: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletConnection: () => Promise<void>;
  verifyWalletIdentityManually: () => Promise<void>;
}

const WalletIdentityContext = createContext<WalletIdentityContextType>({
  stakeAddress: null,
  usedAddresses: null,
  isVerified: false,
  isWalletLoading: false,
  walletIdentityError: null,
  walletLocked: false,
  refreshWalletIdentity: async () => {},
  disconnectWallet: () => {},
  checkWalletConnection: async () => {},
  verifyWalletIdentityManually: async () => {},
});

export const useWalletIdentity = () => useContext(WalletIdentityContext);

export const WalletIdentityProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [stakeAddress, setStakeAddress] = useState<string | null>(null);
  const [usedAddresses, setUsedAddresses] = useState<string[] | null>(null);
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
    setUsedAddresses(null);
    setPreviousStakeAddress(null);
    setIsVerified(false);
    setIsConnected(false);
    setEnabledWallet(null);
    setPreviousWallet(null);
    verifiedStakeAddressRef.current = null;
    latestStakeAddressRef.current = null;
    setWalletLocked(false);
    
    // Clear any stored state in localStorage
    localStorage.removeItem('last_connected_stake_address');
    localStorage.removeItem("verifiedStakeAddress"); 
    localStorage.removeItem("verifiedPaymentAddress"); // Also clear payment address
    
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
    
    const cached = localStorage.getItem("verifiedStakeAddress");
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
  const verifyWalletIdentity = async (stakeAddr: string, api: any) => {
    try {
      // Get the payment address (more secure than using stake address)
      const paymentAddress = await api.getChangeAddress();
      console.log("📦 paymentAddress =", paymentAddress);
      
      if (!paymentAddress) {
        throw new Error("No payment address available");
      }

      // Create a message to sign - include the current timestamp and payment address
      const messageObject = {
        paymentAddress,
        timestamp: Date.now(),
        action: 'verify_wallet'
      };
      
      // Serialize to JSON string
      const messageJson = JSON.stringify(messageObject);
      console.log("📝 Original JSON message:", messageJson);
      
      // Sign the message with the payment address
      console.log("⏳ Requesting wallet to sign data...");
      const result = await api.signData(paymentAddress, messageJson);
      console.log("✅ Received sign result from wallet:", {
        keyLength: result.key?.length || 0,
        signatureLength: result.signature?.length || 0,
      });
      
      const message = messageJson; // Use the original JSON
      console.log("📝 Message for verification (JSON):", message.substring(0, 30) + "...");
      
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
      const normalizedSignature = normalizeEd25519Signature(rawSignatureHex);
      console.log("✅ Normalized signature length:", normalizedSignature.length, 
        "characters =", Buffer.from(normalizedSignature, 'hex').length, "bytes");
      
      console.log("🔑 Final public key hex:", publicKeyHex);
      console.log("🔢 Payload sizes:", {
        stakeAddress: stakeAddr.length,
        paymentAddress: paymentAddress.length,
        publicKey: publicKeyHex.length,
        rawSignature: rawSignatureHex.length,
        normalizedSignature: normalizedSignature.length,
        message: message.length,
      });

      // Make actual API call to validate the signature
      console.log("📤 Making verification request with payment address");
      const apiUrl = `/api/user/verify-wallet`;
        
      // Log the exact payload being sent to the API
      console.log("📦 Verification API payload:", {
        paymentAddress,
        stakeAddress: stakeAddr.substring(0, 10) + "...", // Send stake address for reference
        pubKeyLength: publicKeyHex.length,
        signatureLength: normalizedSignature.length,
        messageLength: message.length,
        messageFirst20Chars: message.substring(0, 20) + "...",
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
          paymentAddress,
          stakeAddress: stakeAddr, // Include stake address for the backend
          pubKey: publicKeyHex,
          signature: normalizedSignature,
          message
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
      
      // Update verification status based on API response
      if (verifyResult.success) {
        setIsVerified(true);
        verifiedStakeAddressRef.current = stakeAddr;
        latestStakeAddressRef.current = stakeAddr;
        
        // Get and store the payment address for future reference
        try {
          const paymentAddress = await api.getChangeAddress();
          if (paymentAddress) {
            // Store the payment address in localStorage for future security checks
            localStorage.setItem("verifiedPaymentAddress", paymentAddress);
            console.log("✅ Payment address stored for future verification:", 
              paymentAddress.substring(0, 10) + '...');
          }
        } catch (paymentError) {
          console.warn("⚠️ Could not store payment address:", paymentError);
        }
        
        // Store stake address in localStorage
        localStorage.setItem("verifiedStakeAddress", stakeAddr);
        console.log("✅ Verification completed at:", new Date().toISOString());
      } else {
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        // Clear any existing verification data
        localStorage.removeItem("verifiedStakeAddress");
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
        console.log("✅ Stake address (direct):", directStakeAddress.substring(0, 10));

        // CRITICAL FIX: Use REF for reliable comparison
        if (latestStakeAddressRef.current === directStakeAddress) {
          console.log("🔒 Same stake address, preserving verification");
        } else {
          console.log("⚠️ New stake address detected, resetting verification");
          setIsVerified(false);
          verifiedStakeAddressRef.current = null;
          latestStakeAddressRef.current = directStakeAddress;
        }

        setStakeAddress(directStakeAddress);
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
      
      const paymentAddressHex = usedAddresses[0];
      
      // Get the stake address (reward address)
      const rewardAddresses = await api.getRewardAddresses();
      console.log("📦 rewardAddresses =", rewardAddresses);
      
      if (!rewardAddresses || rewardAddresses.length === 0) {
        console.error("❌ No reward addresses returned from wallet");
        setStakeAddress(null);
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        latestStakeAddressRef.current = null;
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
        latestStakeAddressRef.current = null;
        return;
      }
      
      // CRITICAL FIX: Use REF for reliable comparison
      if (latestStakeAddressRef.current === stakeAddrBech32) {
        console.log("🔒 Same stake address, preserving verification");
      } else {
        console.log("⚠️ New stake address detected, resetting verification");
        setIsVerified(false);
        verifiedStakeAddressRef.current = null;
        latestStakeAddressRef.current = stakeAddrBech32;
      }
      
      // Store the stake address in state
      setStakeAddress(stakeAddrBech32);
    } catch (error) {
      console.error("Error fetching stake address:", error);
      setStakeAddress(null);
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
            localStorage.setItem("verifiedPaymentAddress", paymentAddress);
            console.log("✅ Payment address stored for future verification:", 
              paymentAddress.substring(0, 10) + '...');
          }
        } catch (paymentError) {
          console.warn("⚠️ Could not store payment address:", paymentError);
        }
        
        // Store stake address in localStorage
        localStorage.setItem("verifiedStakeAddress", stakeAddress);
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

  // Add this helper function to the file
  const normalizeEd25519Signature = (sigHex: string): string => {
    try {
      console.log("🔎 Starting signature normalization...");
      console.log("📊 Input signature:", { 
        length: sigHex?.length || 0, 
        preview: sigHex?.substring(0, 20) + "...",
        isHex: /^[0-9a-f]+$/i.test(sigHex || "") 
      });
      
      // If the signature is already valid and is 128 or 140 characters, return it as-is
      // Some wallets produce 140-character signatures that should not be trimmed
      if (sigHex && (sigHex.length === 128 || sigHex.length === 140) && /^[0-9a-f]+$/i.test(sigHex)) {
        console.log(`✅ Signature is already a valid format (${sigHex.length} hex chars) - preserving original format`);
        return sigHex;
      }
      
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
      
      // For 140-character signatures, special case - don't trim them
      if (sigHex.length === 140) {
        console.log("🔍 Detected 140-character signature - keeping original format");
        return sigHex;
      }
      
      // Convert to buffer to normalize
      const sigBuffer = Buffer.from(sigHex, 'hex');
      console.log("📊 Converted to buffer:", { bytes: sigBuffer.length });
      
      // Special handling for longer signatures that aren't 140 characters
      // Don't aggressively trim unusual signatures
      if (sigBuffer.length > 64 && sigHex.length !== 140) {
        // Check if it's the expected Cardano signature length
        if (sigBuffer.length === 70) {
          console.log(`✅ Signature is already a valid Cardano signature format`);
          return sigHex;
        }
      }
      
      return sigHex;
    } catch (error) {
      console.error("❌ Signature normalization error:", error);
      throw error;
    }
  };

  return (
    <WalletIdentityContext.Provider
      value={{
        stakeAddress,
        usedAddresses,
        isVerified,
        isWalletLoading,
        walletIdentityError,
        walletLocked,
        refreshWalletIdentity,
        disconnectWallet,
        checkWalletConnection,
        verifyWalletIdentityManually,
      }}
    >
      {children}
    </WalletIdentityContext.Provider>
  );
};
