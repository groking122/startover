// ⚠️ DEPRECATED ENDPOINT ⚠️
// This endpoint now redirects to the main /api/inbox endpoint

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Log a warning about using deprecated endpoint
    console.warn('⚠️ Using deprecated /api/messages/all-partners endpoint - redirecting to /api/inbox');
    
    // Clone the request to forward it to the new endpoint
    const newRequest = new Request(`${new URL(req.url).origin}/api/inbox`, {
      method: 'POST',
      headers: req.headers,
      body: req.body
    });
    
    // Forward the request to the main inbox API
    const response = await fetch(newRequest);
    return response;
    
  } catch (error) {
    console.error('Error processing deprecated all-partners request:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 