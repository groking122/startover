// This file ensures the chat route is handled properly
// by the App Router in Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'edge';

// This handler isn't used directly, but its exports
// ensure proper configuration for the chat page
export async function GET() {
  return new Response(JSON.stringify({
    message: 'Chat page configuration - client-side only route'
  }), {
    headers: {
      'content-type': 'application/json',
    },
  });
} 