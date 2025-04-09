/**
 * TypeScript interfaces for messages and conversations
 */

/**
 * Interface for a message
 */
export interface Message {
  id: string;
  from_address: string;
  to_address: string;
  from_public_address?: string; // Added for public address support
  to_public_address?: string;   // Added for public address support
  message: string;
  is_read: boolean;
  created_at: string;
  signature?: string;
  public_key?: string;
}

/**
 * Interface for a conversation
 */
export interface Conversation {
  partner_address: string;
  partner_public_address?: string; // Added for public address support
  last_message: string;
  last_message_id: string;
  last_message_time: string;
  unread_count: number;
  is_partner_verified: boolean;
}

/**
 * Type for message sending request
 */
export interface SendMessageRequest {
  to: string;                  // Can be either stake address or public address
  to_public_address?: string;  // Optional explicit public address
  message: string;
  signature?: string;
  publicKey?: string;
}

/**
 * Type for message sending response
 */
export interface SendMessageResponse {
  success: boolean;
  message: string;
  id?: string;
  timestamp?: string;
  error?: string;
  details?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

/**
 * Type for fetching messages response
 */
export interface GetMessagesResponse {
  success: boolean;
  messages: Message[];
  error?: string;
  details?: string;
}

/**
 * Type for fetching conversations response
 */
export interface GetConversationsResponse {
  success: boolean;
  conversations: Conversation[];
  error?: string;
  details?: string;
}

/**
 * Type for message API errors
 */
export interface MessageApiError {
  error: string;
  details?: string;
  retryAfter?: string;
  limit?: number;
  remaining?: number;
} 