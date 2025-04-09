import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limit configuration
const DEFAULT_LIMIT = 10; // Default requests per window
const DEFAULT_WINDOW_SEC = 60; // Default window in seconds

interface RateLimitCheck {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  message?: string;
}

/**
 * Check and update rate limit for a given key
 * @param key Unique identifier for rate limiting (e.g., 'message:{stakeAddress}')
 * @param limit Maximum number of requests allowed in the time window
 * @param windowSec Time window in seconds
 * @returns Result of rate limit check
 */
export async function checkRateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowSec: number = DEFAULT_WINDOW_SEC
): Promise<RateLimitCheck> {
  try {
    // Clean up any expired rate limits first (good practice to avoid table bloat)
    await supabase
      .from('rate_limits')
      .delete()
      .lt('reset_at', new Date().toISOString());

    // Check if this key already has a rate limit record
    const { data, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
      console.error('Error checking rate limit:', error);
      // On error, allow the request to proceed as a fallback
      return {
        success: true,
        limit,
        remaining: 1,
        resetAt: new Date(Date.now() + windowSec * 1000),
        message: 'Rate limit check failed, proceeding anyway'
      };
    }

    const now = new Date();
    
    // If we found an existing record
    if (data) {
      const resetAt = new Date(data.reset_at);
      
      // If the reset time has passed, create a new rate limit entry
      if (resetAt < now) {
        // Reset the rate limit counter
        const newResetAt = new Date(now.getTime() + windowSec * 1000);
        await supabase
          .from('rate_limits')
          .update({
            count: 1,
            reset_at: newResetAt.toISOString()
          })
          .eq('key', key);
          
        return {
          success: true,
          limit,
          remaining: limit - 1,
          resetAt: newResetAt
        };
      }
      
      // If we're still within the window, increment the counter
      const currentCount = data.count;
      
      // Check if we're over the limit
      if (currentCount >= limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          resetAt,
          message: `Rate limit exceeded. Try again after ${resetAt.toISOString()}`
        };
      }
      
      // Increment the count since we're still under the limit
      await supabase
        .from('rate_limits')
        .update({
          count: currentCount + 1
        })
        .eq('key', key);
        
      return {
        success: true,
        limit,
        remaining: limit - (currentCount + 1),
        resetAt
      };
    }
    
    // No existing record, create a new one
    const resetAt = new Date(now.getTime() + windowSec * 1000);
    await supabase
      .from('rate_limits')
      .insert({
        key,
        count: 1,
        reset_at: resetAt.toISOString()
      });
      
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    
    // On unexpected error, allow the request (fail open)
    return {
      success: true,
      limit,
      remaining: 1,
      resetAt: new Date(Date.now() + windowSec * 1000),
      message: 'Rate limit check failed, proceeding anyway'
    };
  }
}

/**
 * Generate a rate limit key for a specific action and identifier
 * @param action The action being rate limited (e.g., 'message', 'verify')
 * @param identifier The unique identifier (usually wallet address)
 * @returns A formatted rate limit key
 */
export function getRateLimitKey(action: string, identifier: string): string {
  return `${action}:${identifier}`;
} 