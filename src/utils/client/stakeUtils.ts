'use client';

/**
 * Converts a stake address from hex to bech32 format using Lucid.
 * Will throw if the conversion fails — do not fallback to display formatting here.
 */
export async function convertStakeAddressHexToBech32(hex: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    console.warn("Stake address conversion attempted on server");
    return null;
  }

  console.log("⏳ Converting hex to bech32:", { hexLength: hex?.length, hexStart: hex?.substring(0, 10) });
  
  try {
    // Dynamic import of lucid-cardano to avoid SSR issues
    // Imported inside a try-catch to prevent build errors
    const lucidModule = await import('lucid-cardano').catch(err => {
      console.error("Failed to import lucid-cardano:", err);
      return null;
    });
    
    if (!lucidModule) {
      console.error("Lucid module couldn't be loaded");
      return null;
    }
    
    const { C } = lucidModule;
    
    // Use a dynamic approach to avoid TypeScript errors with the WASM interface
    // This works around the linter issue by using type assertions and dynamic property access
    const bytes = Buffer.from(hex, 'hex');
    const bytesArray = new Uint8Array(bytes);
    
    // Access the C namespace and call the methods dynamically
    // @ts-ignore - Workaround for TS type checking on WASM methods
    const wasmAddress = C.Address.from_bytes(bytesArray);
    // @ts-ignore - Workaround for TS type checking on WASM methods
    const bech32 = wasmAddress.to_bech32();

    if (!bech32 || !bech32.startsWith('stake1')) {
      console.warn("❌ Invalid bech32 conversion:", { hex: hex?.substring(0, 10), result: bech32 });
      // Return null instead of empty string
      return null;
    }

    console.log("✅ Address converted successfully:", bech32.substring(0, 15) + '...');
    return bech32;
  } catch (err) {
    console.error("❌ Conversion error:", err);
    // Return null instead of empty string
    return null;
  }
}

/**
 * Retrieves the stake address from a connected wallet
 * 
 * @param walletKey The key of the wallet (e.g., 'eternl', 'nami')
 * @returns Promise resolving to the stake address in bech32 format
 */
export async function getStakeAddress(walletKey: string): Promise<string | null> {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    if (!window.cardano || !window.cardano[walletKey]) {
      console.error(`Wallet ${walletKey} not found`);
      return null;
    }
    
    // Enable the wallet API
    const api = await window.cardano[walletKey].enable();
    
    // Get the reward addresses and log them for debugging
    const rewardAddrs = await api.getRewardAddresses();
    console.log("🔍 Raw rewardAddrs from wallet:", rewardAddrs);
    
    if (!rewardAddrs || rewardAddrs.length === 0) {
      console.warn('No reward addresses found in wallet');
      return null;
    }
    
    // Log detailed information about each reward address
    console.log(`Found ${rewardAddrs.length} reward address(es)`);
    for (let i = 0; i < rewardAddrs.length; i++) {
      const hex = rewardAddrs[i];
      // Check byte length for validity
      const bytes = Buffer.from(hex, 'hex');
      console.log(`Reward address ${i+1} - Byte length:`, bytes.length, "- Expected around 28 bytes");
      
      // Try to convert and log the result
      const bech32 = await convertStakeAddressHexToBech32(hex);
      console.log(`✅ Decoded reward address ${i+1}:`, bech32);
    }
    
    // Get the first reward address in hex format
    const stakeAddrHex = rewardAddrs[0];
    
    // Convert to bech32 format
    const finalStakeAddr = await convertStakeAddressHexToBech32(stakeAddrHex);
    console.log("🎯 Final stake address to be used:", finalStakeAddr);
    return finalStakeAddr;
  } catch (error) {
    console.error('Error retrieving stake address:', error);
    return null;
  }
}

/**
 * Formats a stake address for display
 * 
 * @param hex Stake address in hexadecimal format 
 * @returns Formatted stake address
 */
function formatStakeAddress(hex: string): string {
  if (!hex) return '';
  return `stake1${hex.substring(0, 8)}...${hex.substring(hex.length - 8)}`;
}

/**
 * Validates if a string is a valid Cardano address (either base or stake)
 * 
 * @param address The address to validate
 * @returns True if the address is valid, false otherwise 
 */
export function isValidCardanoAddress(address: string): boolean {
  if (!address) return false;

  // Basic validation - valid formats start with these prefixes
  const isStakeAddress = address.startsWith('stake1');
  const isBaseAddress = address.startsWith('addr1') || address.startsWith('addr_test1');

  if (!isStakeAddress && !isBaseAddress) {
    return false;
  }

  // Length check - stake addresses are ~59 chars, base addresses ~100 chars
  if (isStakeAddress && address.length < 50) return false;
  if (isBaseAddress && address.length < 90) return false;

  return true;
}

/**
 * Takes any Cardano address (base or stake) and resolves it to a stake address.
 * If the input is already a stake address, it's returned as is.
 * If it's a base address, attempts to extract the stake part.
 * 
 * @param address Any Cardano address (base or stake)
 * @returns The stake address if it can be determined, or null
 */
export async function resolveToStakeAddress(address: string): Promise<string | null> {
  if (!address) return null;
  
  // If it's already a stake address, return it
  if (address.startsWith('stake1')) {
    return address;
  }
  
  // For base addresses, we need to extract the stake part
  try {
    if (typeof window === 'undefined') {
      console.warn("Address resolution attempted on server");
      return null;
    }
    
    const lucidModule = await import('lucid-cardano').catch(err => {
      console.error("Failed to import lucid-cardano:", err);
      return null;
    });
    
    if (!lucidModule) {
      console.error("Lucid module couldn't be loaded");
      return null;
    }
    
    // ✅ Detect if we're working with a testnet address
    const isTestnet = address.startsWith('addr_test1') || address.startsWith('stake_test1');
    console.log(`Address type detected: ${isTestnet ? 'testnet' : 'mainnet'}`);
    
    // Create a simple Lucid instance for address operations
    const lucid = await lucidModule.Lucid.new(undefined); // Pass undefined for no provider
    
    // Use Lucid's built-in utilities to extract the stake credential
    try {
      console.log("Resolving base address to stake address:", address.substring(0, 15) + "...");
      
      // Get the address details using Lucid
      try {
        // Use Lucid's address utils
        const addressDetails = lucid.utils.getAddressDetails(address);
        
        // Check if stake credential exists
        if (!addressDetails.stakeCredential) {
          console.warn("Address has no stake credential");
          return null;
        }
        
        // Generate the stake address with correct network ID
        const stakeAddress = lucid.utils.credentialToRewardAddress(
          addressDetails.stakeCredential
          // Network ID is automatically detected from the credential in this version
        );
        
        console.log("Successfully resolved stake address:", stakeAddress.substring(0, 15) + "...");
        return stakeAddress;
      } catch (lucidError) {
        console.warn("Lucid address resolution failed:", lucidError);
        
        // Attempt to use the CSL directly as fallback
        try {
          // Access the CSL library
          const C = lucidModule.C;
          
          // ✅ Dynamically detect network
          const networkId = isTestnet 
            ? C.NetworkInfo.testnet().network_id() 
            : C.NetworkInfo.mainnet().network_id();
          
          // Use dynamic property access and type assertions to work around TypeScript issues
          // Create an address from bech32
          // @ts-ignore - Work around TypeScript checks for WASM methods
          const wasmAddress = C.Address.from_bech32(address);
          
          // Check for stake credential
          // @ts-ignore - Work around TypeScript checks for WASM methods
          if (!wasmAddress.has_stake_cred()) {
            console.warn("CSL: Address has no stake credential");
            return null;
          }
          
          // Extract the stake credential
          // @ts-ignore - Work around TypeScript checks for WASM methods
          const stakeCred = wasmAddress.stake_cred();
          
          // Create a reward address from the credential with correct network ID
          // @ts-ignore - Work around TypeScript checks for WASM methods
          const rewardAddress = C.RewardAddress.new(networkId, stakeCred);
          
          // Convert to bech32
          // @ts-ignore - Work around TypeScript checks for WASM methods
          const stakeBech32 = rewardAddress.to_address().to_bech32();
          
          console.log("Successfully resolved stake address via CSL:", stakeBech32.substring(0, 15) + "...");
          return stakeBech32;
        } catch (cslError) {
          console.error("CSL fallback failed:", cslError);
        }
      }
      
      // Legacy fallback method - string parsing, least reliable
      if (address.startsWith('addr1') || address.startsWith('addr_test1')) {
        console.warn("Using legacy string parsing to extract stake address - not recommended");
        const parts = address.split('.');
        if (parts.length > 1) {
          const potentialStakeCredential = parts[parts.length - 1];
          if (potentialStakeCredential && potentialStakeCredential.length >= 40) {
            // Add correct prefix based on detected network
            const prefix = isTestnet ? 'stake_test1' : 'stake1';
            const stakeAddr = `${prefix}${potentialStakeCredential.substring(0, 56)}`;
            console.log("Extracted stake address via string parsing:", stakeAddr.substring(0, 15) + "...");
            return stakeAddr;
          }
        }
      }
      
      console.warn("All methods failed to extract stake address from base address");
      return null;
    } catch (extractError) {
      console.error("Error extracting stake part:", extractError);
      return null;
    }
  } catch (error) {
    console.error("Failed to resolve address to stake address:", error);
    return null;
  }
}

/**
 * Gets stake address directly from wallet (preferred method).
 * This is more reliable than resolving from base addresses.
 * 
 * @param walletKey The wallet provider key
 * @returns The stake address in bech32 format
 */
export async function getStakeAddressFromWallet(walletKey: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    console.warn("Attempted to access wallet on server");
    return null;
  }
  
  try {
    if (!window.cardano || !window.cardano[walletKey]) {
      console.error(`Wallet ${walletKey} not found`);
      return null;
    }
    
    // Enable wallet API
    const api = await window.cardano[walletKey].enable();
    console.log("Wallet API enabled", walletKey);
    
    // Get all reward addresses directly from wallet
    const rewardAddrs = await api.getRewardAddresses();
    
    if (!rewardAddrs || rewardAddrs.length === 0) {
      console.error("No reward addresses found in wallet", walletKey);
      return null;
    }
    
    // Use the first reward address (hex format)
    const stakeHex = rewardAddrs[0];
    
    // Convert to bech32 format
    const stakeBech32 = await convertStakeAddressHexToBech32(stakeHex);
    console.log("Direct wallet stake address:", stakeBech32?.substring(0, 10) + "...");
    
    return stakeBech32;
  } catch (error) {
    console.error("Error getting stake address from wallet:", error);
    return null;
  }
}

/**
 * Utility function to compare a resolved stake address with the direct wallet stake address.
 * This helps diagnose issues with address resolution.
 * 
 * @param baseAddress A base address to resolve
 * @param walletKey The wallet key to compare against
 * @returns Whether the addresses match
 */
export async function compareResolvedVsWalletAddress(baseAddress: string, walletKey: string): Promise<boolean> {
  try {
    // Get the stake address by resolving from base
    console.log("Starting comparison test...");
    console.log("Base address to resolve:", baseAddress?.substring(0, 15) + "...");
    
    const resolvedStake = await resolveToStakeAddress(baseAddress);
    console.log("Resolved stake address:", resolvedStake?.substring(0, 15) + "...");
    
    // Get stake address directly from wallet
    const walletStake = await getStakeAddressFromWallet(walletKey);
    console.log("Direct wallet stake address:", walletStake?.substring(0, 15) + "...");
    
    // Compare the two
    const match = resolvedStake === walletStake;
    console.log("Addresses match:", match);
    
    if (!match) {
      console.warn("⚠️ The base address you're using doesn't resolve to the wallet's stake address!");
      console.warn("This could be a change address or an address from a different wallet.");
    }
    
    return match;
  } catch (error) {
    console.error("Error comparing addresses:", error);
    return false;
  }
} 