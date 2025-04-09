/**
 * Utilities for secure message sending and fetching using payment addresses
 */

/**
 * Send a message from one wallet to another using secure payment addresses
 * 
 * @param payment_address_from Sender's payment address (verified through wallet)
 * @param payment_address_to Recipient's payment address
 * @param message Message content to send
 * @param stake_address_to Optional stake address for reference
 * @returns Promise with the API response
 */
export async function sendMessage(
  payment_address_from: string, 
  payment_address_to: string, 
  message: string, 
  stake_address_to?: string
) {
  // Validate inputs
  if (!payment_address_from || !payment_address_to || !message) {
    throw new Error("Missing required parameters: payment addresses and message must be provided");
  }

  const res = await fetch('/api/messages/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payment_address_from,
      payment_address_to,
      stake_address_to, // optional
      message,
    })
  });

  const result = await res.json();

  if (!result.success) {
    console.error("❌ Message send error:", result.error);
    throw new Error(result.error);
  }

  console.log("✅ Message sent successfully:", result.data);
  return result.data;
}

/**
 * Fetch messages for a specific payment address
 * 
 * @param paymentAddress The payment address to fetch messages for
 * @returns Promise with the messages array
 */
export async function fetchMessages(paymentAddress: string) {
  if (!paymentAddress) {
    throw new Error("Payment address required to fetch messages");
  }

  const res = await fetch(`/api/messages/inbox?paymentAddress=${encodeURIComponent(paymentAddress)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const result = await res.json();

  if (!result.success) {
    console.error("❌ Message fetch error:", result.error);
    throw new Error(result.error);
  }

  return result.messages;
} 