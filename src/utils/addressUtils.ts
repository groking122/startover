/**
 * Address utilities for Cardano blockchain
 * Handles conversion between stake addresses and public addresses
 */

/**
 * Validates if a string is a valid Cardano address
 * @param address The address to validate
 * @returns boolean indicating if the address is valid
 */
export function isValidCardanoAddress(address: string): boolean {
  if (!address) return false;
  const isStakeAddress = address.startsWith('stake1');
  const isBaseAddress = address.startsWith('addr1') || address.startsWith('addr_test1');
  // Both stake addresses and base addresses (public addresses) are valid
  return (isStakeAddress || isBaseAddress) && address.length >= 50;
}

/**
 * Determines if an address is a stake address
 * @param address The address to check
 * @returns boolean indicating if the address is a stake address
 */
export function isStakeAddress(address: string): boolean {
  return !!address && address.startsWith('stake1') && address.length >= 50;
}

/**
 * Determines if an address is a public address (base address)
 * @param address The address to check
 * @returns boolean indicating if the address is a public address
 */
export function isPublicAddress(address: string): boolean {
  return !!address && (address.startsWith('addr1') || address.startsWith('addr_test1')) && address.length >= 50;
}

/**
 * Extracts the stake portion from a public address
 * Note: This is a placeholder implementation. In a real application, this would use
 * proper Cardano serialization libraries to extract the stake portion from a base address.
 * 
 * @param publicAddress The public address to extract from
 * @returns The stake address or null if extraction failed
 */
export function getStakeAddressFromPublic(publicAddress: string): string | null {
  // This is a placeholder. In a real implementation, you would:
  // 1. Decode the bech32 address
  // 2. Extract the stake key hash
  // 3. Encode it as a stake address
  
  // For demonstration, we'll return a dummy implementation
  if (!isPublicAddress(publicAddress)) {
    return null;
  }
  
  // This is just for demonstration - it's not a valid implementation
  // In a real app, use the Cardano serialization library
  console.warn('Using placeholder implementation for getStakeAddressFromPublic');
  return `stake1${publicAddress.substring(20, 50)}`;
}

/**
 * Normalizes an address to its stake form when possible
 * @param address Any Cardano address (stake or public)
 * @returns The stake address if possible, otherwise the original address
 */
export function normalizeToStakeAddress(address: string): string {
  if (isStakeAddress(address)) {
    return address;
  }
  
  if (isPublicAddress(address)) {
    return getStakeAddressFromPublic(address) || address;
  }
  
  return address;
}

/**
 * Gets the appropriate address field name based on the address type
 * @param address The address to check
 * @returns The field name to use in database queries
 */
export function getAddressFieldName(address: string): 'stake_address' | 'public_address' {
  return isStakeAddress(address) ? 'stake_address' : 'public_address';
} 