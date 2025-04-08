// Utility function to extract unique conversation partners from messages
export function resolveInboxPartners(messages: any[], userAddress: string): string[] {
  // Determine if user's address is a base or stake address
  const isBase = userAddress.startsWith('addr1') || userAddress.startsWith('addr_test1');
  const isStake = userAddress.startsWith('stake1') || userAddress.startsWith('stake_test1');
  
  if (!isBase && !isStake) {
    console.warn('Invalid address format provided to resolveInboxPartners:', 
      userAddress?.substring(0, 10) + '...');
  }
  
  // Use Set to ensure uniqueness of partner addresses
  const partners = new Set<string>();

  // Process each message to extract partners
  for (const msg of messages) {
    // Skip messages with invalid data
    if (!msg.from || !msg.to) continue;
    
    // CASE 1: User is the sender
    if (msg.from === userAddress) {
      // Add the recipient's primary address
      partners.add(msg.to);
      
      // Also add the secondary address if it exists and is different
      if (msg.to_address && msg.to_address !== msg.to) {
        partners.add(msg.to_address);
      }
    } 
    // CASE 2: User is the recipient (by primary address)
    else if (msg.to === userAddress) {
      partners.add(msg.from);
    }
    // CASE 3: User is the recipient (by secondary/base address)
    else if (isBase && msg.to_address === userAddress) {
      partners.add(msg.from);
    }
  }

  return Array.from(partners);
} 