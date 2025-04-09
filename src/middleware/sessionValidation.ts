import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Session validation constants
const SESSION_HEADER = 'x-wallet-session';
const SESSION_EXPIRY_MS = 3600000; // 1 hour

/**
 * Validates a session token from the request headers
 * @param token The session token to validate
 * @returns An object containing validation result and wallet address if valid
 */
async function validateToken(token: string): Promise<{ isValid: boolean; walletAddress: string | null }> {
  try {
    // Decode the token
    const decoded = atob(token);
    const [address, expiryTimestamp] = decoded.split(':');
    
    // Check if token format is valid
    if (!address || !expiryTimestamp) {
      console.warn('Invalid token format');
      return { isValid: false, walletAddress: null };
    }
    
    // Check if token has expired
    const expiry = parseInt(expiryTimestamp, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      console.warn('Token expired');
      return { isValid: false, walletAddress: null };
    }
    
    // Validate that this is a public address
    const isPublicAddress = address.startsWith('addr1') || address.startsWith('addr_test1');
    if (!isPublicAddress) {
      console.warn('Non-public address provided: ' + address.substring(0, 10) + '...');
      return { isValid: false, walletAddress: null };
    }
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    
    // Check if the address exists and is verified in the database
    const { data, error } = await supabase
      .from('users')
      .select('last_verified')
      .eq('public_address', address)
      .single();
    
    if (error || !data) {
      console.warn('User not found in database', error);
      return { isValid: false, walletAddress: null };
    }
    
    // Check if the user has been verified
    if (!data.last_verified) {
      console.warn('User not verified');
      return { isValid: false, walletAddress: null };
    }
    
    // Check if the verification is still valid (less than 1 hour old)
    const verificationTime = new Date(data.last_verified);
    const elapsedMs = Date.now() - verificationTime.getTime();
    if (elapsedMs > SESSION_EXPIRY_MS) {
      console.warn('Verification expired');
      return { isValid: false, walletAddress: null };
    }
    
    // Session is valid
    return { isValid: true, walletAddress: address };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false, walletAddress: null };
  }
}

/**
 * Middleware function to validate session tokens for protected API routes
 * @param req Next.js request object
 * @returns Next.js response or undefined to continue
 */
export async function validateSession(req: NextRequest): Promise<NextResponse | undefined> {
  // Get the session token from the request headers
  const token = req.headers.get(SESSION_HEADER);
  
  // Skip validation for public routes
  const url = req.nextUrl.pathname;
  if (url === '/api/user/verify' || url.startsWith('/api/public/')) {
    return undefined;
  }
  
  // If no token is provided, return unauthorized
  if (!token) {
    console.warn('No session token provided');
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Validate the token
  const { isValid, walletAddress } = await validateToken(token);
  
  // If token is invalid, return unauthorized
  if (!isValid || !walletAddress) {
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }
  
  // Add wallet address to request headers for use in API routes
  const requestHeaders = new Headers(req.headers);
  
  // Set the generic wallet address header (primary identifier)
  requestHeaders.set('x-wallet-address', walletAddress);
  
  // Also set public address header
  requestHeaders.set('x-public-address', walletAddress);
  
  // Continue to the API route with the validated wallet address
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Helper function to get the validated wallet address from a request
 * @param req Next.js request object
 * @returns The validated wallet address or null
 */
export function getValidatedWalletAddress(req: NextRequest): string | null {
  return req.headers.get('x-wallet-address');
}

/**
 * Helper function to get the validated public address from a request
 * @param req Next.js request object
 * @returns The validated public address or null
 */
export function getValidatedPublicAddress(req: NextRequest): string | null {
  return req.headers.get('x-public-address');
} 