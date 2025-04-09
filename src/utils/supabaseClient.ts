import { createClient } from '@supabase/supabase-js';

// Check if required environment variables are defined
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Some functionality may be limited.');
}

// Create and export the Supabase client with service role key (for server-side operations)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create and export the Supabase client with anon key (for client-side operations)
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default supabaseAdmin; 