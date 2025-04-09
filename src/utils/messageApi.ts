import { 
  SendMessageRequest, 
  SendMessageResponse, 
  GetMessagesResponse, 
  GetConversationsResponse,
  MessageApiError
} from '@/types/messages';
import { getSessionToken } from './sessionManager';

/**
 * Send a message to another user
 * @param payload Message data to send
 * @returns Response from the API
 */
export async function sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
  try {
    // Get session token for authentication
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      throw new Error('No active session. Please verify your wallet first.');
    }
    
    // Make API call
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-session': sessionToken
      },
      body: JSON.stringify(payload)
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const data = await response.json();
      
      throw {
        error: data.error || 'Rate limit exceeded',
        retryAfter: data.retryAfter || (retryAfter ? new Date(Date.now() + parseInt(retryAfter) * 1000).toISOString() : undefined),
        limit: data.limit,
        remaining: data.remaining
      } as MessageApiError;
    }
    
    // Parse response
    const data = await response.json();
    
    // Handle API errors
    if (!response.ok) {
      throw {
        error: data.error || 'Failed to send message',
        details: data.details
      } as MessageApiError;
    }
    
    return data as SendMessageResponse;
  } catch (error) {
    if ((error as any).error) {
      // Already formatted error
      throw error;
    }
    
    // Format other errors
    throw {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    } as MessageApiError;
  }
}

/**
 * Get messages for a conversation with a specific partner
 * @param partner Partner stake address
 * @param limit Maximum number of messages to retrieve
 * @param before Timestamp to paginate from
 * @returns Response with messages
 */
export async function getMessages(
  partner?: string, 
  limit?: number, 
  before?: string
): Promise<GetMessagesResponse> {
  try {
    // Get session token for authentication
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      throw new Error('No active session. Please verify your wallet first.');
    }
    
    // Build URL with query parameters
    let url = '/api/message';
    const params = new URLSearchParams();
    
    if (partner) params.append('partner', partner);
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    // Make API call
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-session': sessionToken
      }
    });
    
    // Parse response
    const data = await response.json();
    
    // Handle API errors
    if (!response.ok) {
      throw {
        error: data.error || 'Failed to retrieve messages',
        details: data.details
      } as MessageApiError;
    }
    
    return data as GetMessagesResponse;
  } catch (error) {
    if ((error as any).error) {
      // Already formatted error
      throw error;
    }
    
    // Format other errors
    throw {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    } as MessageApiError;
  }
}

/**
 * Get list of conversations for the current user
 * @returns Response with conversations
 */
export async function getConversations(): Promise<GetConversationsResponse> {
  try {
    // Get session token for authentication
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      throw new Error('No active session. Please verify your wallet first.');
    }
    
    // Make API call
    const response = await fetch('/api/conversations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-session': sessionToken
      }
    });
    
    // Parse response
    const data = await response.json();
    
    // Handle API errors
    if (!response.ok) {
      throw {
        error: data.error || 'Failed to retrieve conversations',
        details: data.details
      } as MessageApiError;
    }
    
    return data as GetConversationsResponse;
  } catch (error) {
    if ((error as any).error) {
      // Already formatted error
      throw error;
    }
    
    // Format other errors
    throw {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    } as MessageApiError;
  }
}

/**
 * Mark messages as read
 * @param options Either message IDs or a partner ID to mark all messages from that partner as read
 * @returns Response with the number of updated messages
 */
export async function markAsRead(options: { messageIds?: string[], partnerId?: string }): Promise<{ success: boolean, updatedCount: number }> {
  try {
    // Get session token for authentication
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      throw new Error('No active session. Please verify your wallet first.');
    }
    
    // Make API call
    const response = await fetch('/api/message/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-session': sessionToken
      },
      body: JSON.stringify(options)
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const data = await response.json();
      
      throw {
        error: data.error || 'Rate limit exceeded',
        retryAfter: data.retryAfter || (retryAfter ? new Date(Date.now() + parseInt(retryAfter) * 1000).toISOString() : undefined),
        limit: data.limit,
        remaining: data.remaining
      } as MessageApiError;
    }
    
    // Parse response
    const data = await response.json();
    
    // Handle API errors
    if (!response.ok) {
      throw {
        error: data.error || 'Failed to mark messages as read',
        details: data.details
      } as MessageApiError;
    }
    
    return {
      success: data.success,
      updatedCount: data.updatedCount
    };
  } catch (error) {
    if ((error as any).error) {
      // Already formatted error
      throw error;
    }
    
    // Format other errors
    throw {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    } as MessageApiError;
  }
}

/**
 * Get unread message counts for the current user
 * @param partnerId Optional partner ID to get unread count for a specific conversation
 * @returns Response with unread counts
 */
export async function getUnreadCounts(partnerId?: string): Promise<{
  success: boolean;
  unreadCount: number;
  unreadByPartner?: Record<string, number>;
}> {
  try {
    // Get session token for authentication
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      throw new Error('No active session. Please verify your wallet first.');
    }
    
    // Build URL with query parameters
    let url = '/api/message/unread-count';
    
    if (partnerId) {
      url += `?partner=${partnerId}`;
    }
    
    // Make API call
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-session': sessionToken
      }
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const data = await response.json();
      
      throw {
        error: data.error || 'Rate limit exceeded',
        retryAfter: data.retryAfter || (retryAfter ? new Date(Date.now() + parseInt(retryAfter) * 1000).toISOString() : undefined),
        limit: data.limit,
        remaining: data.remaining
      } as MessageApiError;
    }
    
    // Parse response
    const data = await response.json();
    
    // Handle API errors
    if (!response.ok) {
      throw {
        error: data.error || 'Failed to get unread counts',
        details: data.details
      } as MessageApiError;
    }
    
    return {
      success: data.success,
      unreadCount: data.unreadCount,
      unreadByPartner: data.unreadByPartner
    };
  } catch (error) {
    if ((error as any).error) {
      // Already formatted error
      throw error;
    }
    
    // Format other errors
    throw {
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    } as MessageApiError;
  }
} 