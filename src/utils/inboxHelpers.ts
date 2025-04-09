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
    if (!msg.payment_address_from || !msg.payment_address_to) continue;
    
    // CASE 1: User is the sender
    if (msg.payment_address_from === userAddress) {
      // Add the recipient's primary address
      partners.add(msg.payment_address_to);
      
      // Also add the secondary address if it exists and is different
      if (msg.stake_address_to && msg.stake_address_to !== msg.payment_address_to) {
        partners.add(msg.stake_address_to);
      }
    } 
    // CASE 2: User is the recipient (by primary address)
    else if (msg.payment_address_to === userAddress) {
      partners.add(msg.payment_address_from);
    }
    // CASE 3: User is the recipient (by secondary/base address)
    else if (isBase && msg.stake_address_to === userAddress) {
      partners.add(msg.payment_address_from);
    }
  }

  return Array.from(partners);
} 