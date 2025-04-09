import { NextResponse, NextRequest } from 'next/server';
import { validateSession } from './middleware/sessionValidation';

// Define which routes should be protected by session validation
const API_MATCHER = /^\/api\/(?!public\/|user\/verify)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only apply to API routes and exclude public routes
  if (API_MATCHER.test(pathname)) {
    // Apply session validation middleware
    const response = await validateSession(request);
    if (response) {
      return response;
    }
  }
  
  // Continue with the request for all other routes
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    // Apply to all API routes except specific exclusions
    '/api/:path*',
  ],
}; 