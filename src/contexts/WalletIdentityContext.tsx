'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
import { createSession, getSession, clearSession } from '@/utils/sessionManager';

interface WalletIdentityContextType {
  publicAddress: string | null;  // Public address (payment address)
  usedAddresses: string[] | null;
  isVerified: boolean;
  isWalletLoading: boolean;
  walletIdentityError: string | null;
  refreshWalletIdentity: () => Promise<void>;
  disconnectWallet: () => void;
  checkWalletConnection: () => Promise<void>;
  verifyWalletIdentityManually: () => Promise<void>;
}

const WalletIdentityContext = createContext<WalletIdentityContextType>({
  publicAddress: null,
  usedAddresses: null,
  isVerified: false,
  isWalletLoading: false,
  walletIdentityError: null,
  refreshWalletIdentity: async () => {},
  disconnectWallet: () => {},
  checkWalletConnection: async () => {},
  verifyWalletIdentityManually: async () => {},
});

export const useWalletIdentity = () => useContext(WalletIdentityContext);

export const WalletIdentityProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [publicAddress, setPublicAddress] = useState<string | null>(null);
  const [usedAddresses, setUsedAddresses] = useState<string[] | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [walletIdentityError, setWalletIdentityError] = useState<string | null>(null);
  
  // Use state to hold wallet connection info
  const [isConnected, setIsConnected] = useState(false);
  const [enabledWallet, setEnabledWallet] = useState<string | null>(null);
  const [previousWallet, setPreviousWallet] = useState<string | null>(null);
  const [lastVerificationTime, setLastVerificationTime] = useState<Date | null>(null);

  // Get Cardano wallet state at the component level
  const { enabledWallet: cardanoEnabledWallet } = useCardano?.() || {};

  // Handle session retrieval on component mount
  useEffect(() => {
    const loadSession = async () => {
      const session = await getSession();
      if (session) {
        setPublicAddress(session.publicAddress);
        setIsVerified(true);
        const verificationTime = new Date(session.verifiedAt);
        setLastVerificationTime(verificationTime);
      }
    };
    
    loadSession();
  }, []);

  // Set up wallet change event listener
  useEffect(() => {
    const handleWalletChange = () => {
      console.log("Wallet change detected, refreshing state");
      checkWalletConnection();
    };
    
    window.addEventListener("cardano-wallet-change", handleWalletChange);
    
    return () => {
      window.removeEventListener("cardano-wallet-change", handleWalletChange);
    };
  }, []);

  // Check session expiry and wallet connection
  useEffect(() => {
    const interval = setInterval(async () => {
      const session = await getSession();
      
      // If no session but we think we're verified, reset state
      if (!session && isVerified) {
        setIsVerified(false);
      }
      
      // Check wallet connection if we don't have a connected wallet
      if (!enabledWallet) {
        checkWalletConnection();
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [enabledWallet, isVerified]);

  // Initial connection check
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      console.log("Disconnecting wallet...");
      
      // Clear all state
      setPublicAddress(null);
      setUsedAddresses(null);
      setIsVerified(false);
      setEnabledWallet(null);
      setPreviousWallet(null);
      setLastVerificationTime(null);
      
      // Clear session
      clearSession();
      
      console.log("✅ Wallet disconnected successfully");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  }, []);
  
  const checkWalletConnection = useCallback(async () => {
    try {
      // Check if the wallet API is available
      if (typeof window === 'undefined' || !window.cardano) {
        console.log("⚠️ Cardano API not available");
        setWalletIdentityError("Cardano API not available");
        return;
      }
      
      // Get available wallets
      const wallets = Object.keys(window.cardano || {});
      
      if (wallets.length === 0) {
        console.log("⚠️ No Cardano wallets found");
        setWalletIdentityError("No Cardano wallets found");
        return;
      }
      
      // Try to find an enabled wallet
      let walletKey: string | null = null;
      
      // First check if cardanoEnabledWallet from the hook is available
      if (cardanoEnabledWallet && typeof window.cardano[cardanoEnabledWallet] !== 'undefined') {
        walletKey = cardanoEnabledWallet;
        console.log("🔍 Found already enabled wallet from hook:", walletKey);
      } 
      // Then check if our previous wallet is still enabled
      else if (previousWallet && typeof window.cardano[previousWallet] !== 'undefined') {
        try {
          const isEnabled = await isWalletEnabled(previousWallet);
          if (isEnabled) {
            walletKey = previousWallet;
            console.log("🔍 Found previously enabled wallet:", walletKey);
          }
        } catch (err) {
          console.log("Previous wallet no longer available:", previousWallet);
        }
      }
      
      // If we didn't find an enabled wallet, check if the wallet is connected
      if (!walletKey) {
        // Reset connection status if we've lost the wallet connection
        if (enabledWallet) {
          console.log("⚠️ Previously enabled wallet is no longer connected:", enabledWallet);
          disconnectWallet();
        }
        return;
      }
      
      // If we found a new wallet or a different one from before
      if (enabledWallet !== walletKey) {
        console.log("🔍 Wallet detected or changed, updating reference:", walletKey);
        
        // If wallet has changed, reset verification state
        if (enabledWallet && enabledWallet !== walletKey) {
          console.log("⚠️ Wallet changed from", enabledWallet, "to", walletKey, "- resetting verification state");
          setIsVerified(false);
        }
        
        setEnabledWallet(walletKey);
        setPreviousWallet(walletKey);
        
        await fetchWalletAddresses(walletKey);
      }

      // Check if verification is still valid based on time
      if (isVerified && lastVerificationTime) {
        const now = new Date();
        const elapsedMs = now.getTime() - lastVerificationTime.getTime();
        
        // If verification is older than 1 hour (3600000 ms), invalidate it
        if (elapsedMs > 3600000) {
          console.log("🔒 Verification expired after 1 hour, resetting state");
          setIsVerified(false);
          clearSession();
        }
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
      // Reset state on error
      setEnabledWallet(null);
      setPublicAddress(null);
      setIsVerified(false);
      setWalletIdentityError(error instanceof Error ? error.message : String(error));
    }
  }, [enabledWallet, disconnectWallet, isVerified, lastVerificationTime, cardanoEnabledWallet, previousWallet]);

  // Fetch wallet addresses
  const fetchWalletAddresses = async (walletKey: string) => {
    try {
      setIsWalletLoading(true);
      setWalletIdentityError(null);
      
      console.log("🔍 Fetching wallet addresses for", walletKey);
      
      // Get the wallet API
      const api = await window.cardano[walletKey].enable();
      
      // Get payment/used addresses
      let newUsedAddresses: string[] = [];
      try {
        newUsedAddresses = await api.getUsedAddresses();
        console.log("🔑 Fetched used addresses:", newUsedAddresses.length > 0
          ? newUsedAddresses[0].substring(0, 10) + '...'
          : 'none');
      } catch (error) {
        console.error("Failed to get used addresses:", error);
        throw new Error("Could not get public addresses from wallet. Please ensure your wallet is properly connected.");
      }
      
      // Ensure we have at least one public address
      if (!newUsedAddresses || newUsedAddresses.length === 0) {
        throw new Error("No public addresses available in wallet. Please ensure your wallet has at least one used address.");
      }
      
      // Set public address to first used address - this is our main identifier
      const newPublicAddress = newUsedAddresses[0];
      setPublicAddress(newPublicAddress);
      setUsedAddresses(newUsedAddresses);
      
      // After fetching addresses, check if the session is valid
      const session = await getSession();
      if (session && session.publicAddress === newPublicAddress) {
        setIsVerified(true);
        setLastVerificationTime(new Date(session.verifiedAt));
      } else if (isVerified) {
        // If the addresses don't match but we thought we were verified, reset
        setIsVerified(false);
      }
      
      setIsWalletLoading(false);
    } catch (error) {
      console.error("Error fetching wallet addresses:", error);
      setIsWalletLoading(false);
      setWalletIdentityError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
  
  // Create a function to refresh wallet identity
  const refreshWalletIdentity = async () => {
    try {
      if (enabledWallet) {
        await fetchWalletAddresses(enabledWallet);
      } else {
        await checkWalletConnection();
      }
    } catch (error) {
      console.error("Error refreshing wallet identity:", error);
      setWalletIdentityError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Create a function to handle wallet identity verification
  const verifyWalletIdentity = async (publicAddr: string, api: any) => {
    try {
      // Get payment addresses
      const usedAddresses = await api.getUsedAddresses();
      console.log("📦 usedAddresses =", usedAddresses);
      
      if (!usedAddresses || usedAddresses.length === 0) {
        throw new Error("No used addresses available");
      }

      // Get the first payment address (hex format)
      const paymentAddressHex = usedAddresses[0];
      
      // Create a message to sign - include the current timestamp and public address
      const messageObject = {
        publicAddress: paymentAddressHex,
        timestamp: new Date().toISOString(),
        action: 'verify_wallet'
      };
      
      // Serialize to JSON string
      const messageJson = JSON.stringify(messageObject);
      console.log("📝 Original JSON message:", messageJson);
      
      // Most Cardano wallets require the message in hex format for signing
      const messageHex = Buffer.from(messageJson).toString('hex');
      console.log("📝 Message converted to hex for signing:", messageHex);
      console.log("📤 messageHex (to sign):", messageHex);
      
      // Sign the message with the payment address (using hex format)
      console.log("⏳ Requesting wallet to sign data...");
      const result = await api.signData(paymentAddressHex, messageHex);
      console.log("✅ Received sign result from wallet:", {
        keyLength: result.key?.length || 0,
        signatureLength: result.signature?.length || 0,
      });
      
      // Important: for verification we need to use the ORIGINAL message that was signed
      const message = messageJson;
      
      // Convert signature and key to hex strings if not already
      const signature = typeof result.signature === 'string' 
        ? result.signature 
        : Buffer.from(result.signature).toString('hex');
      
      const publicKey = typeof result.key === 'string'
        ? result.key
        : Buffer.from(result.key).toString('hex');
        
      console.log("🔑 publicKey:", publicKey);
      console.log("✍️ signature:", signature);
      
      // Send to server for verification
      console.log("🔐 Sending verification request to server...");
      
      const verifyResponse = await fetch('/api/user/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          signature,
          pubKey: publicKey,
          publicAddress: publicAddr
        }),
      });
      
      // Check for rate limiting
      if (verifyResponse.status === 429) {
        const rateLimitData = await verifyResponse.json();
        const retryAfter = rateLimitData.retryAfter || 10;
        
        const errorMessage = `Too many verification attempts. Please wait ${retryAfter} seconds and try again.`;
        toast.error(errorMessage, { id: "verify" });
        throw new Error(errorMessage);
      }
      
      // Check for other server errors
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        const errorMessage = errorData.error || `Server error: ${verifyResponse.status}`;
        toast.error(errorMessage, { id: "verify" });
        throw new Error(errorMessage);
      }
      
      // Parse verification result
      const verifyResult = await verifyResponse.json();
      console.log("🔐 Server verification result:", verifyResult);
      
      // Update verification status based on API response
      if (verifyResult.verified) {
        toast.success("Wallet verified!");
        
        // Save the verification timestamp
        setLastVerificationTime(new Date());
        
        // Set verified state and address
        setIsVerified(true);
        
        return true;
      } else {
        console.log("❌ Verification failed:", verifyResult);
        
        const errorMessage = verifyResult.error || "Verification failed";
        toast.error(`Could not verify wallet: ${errorMessage}`);
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("❌ Error in verifyWalletIdentity:", err);
      
      // Handle various error cases
      const errorMessage = err instanceof Error ? err.message : String(err);
      setWalletIdentityError(errorMessage);
      
      // Only show toast if it's not a rate limit error (those are handled above)
      if (!(errorMessage.includes("Rate limited") || errorMessage.includes("Too many verification attempts"))) {
        toast.error(errorMessage);
      }
      
      return false;
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
    if (!publicAddress) {
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
      
      // Verify wallet identity
      const verified = await verifyWalletIdentity(publicAddress, api);
      
      if (verified) {
        // Create a session
        await createSession(publicAddress);
        toast.success("Wallet verified successfully!", { id: "verify" });
      } else {
        toast.error("Wallet verification failed.", { id: "verify" });
      }
    } catch (error) {
      console.error("❌ Error in verifyWalletIdentityManually:", error);
      toast.error(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: "verify" });
    } finally {
      setIsWalletLoading(false);
    }
  };

  const value = {
    publicAddress,
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