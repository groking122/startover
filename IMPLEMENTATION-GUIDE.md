# Cardano Wallet Chat Implementation Guide

This guide outlines the step-by-step process for implementing and deploying the secure Cardano Wallet Chat application. Follow these instructions to set up the application with all security enhancements.

## Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account for database
- Vercel account for deployment (optional)
- Basic knowledge of Next.js, React, and TypeScript
- Cardano wallet for testing (Eternl, Nami, Flint, etc.)

## Setup Steps

### 1. Clone and Configure Project

```bash
# Clone repository (or create a new Next.js project)
git clone <repository-url>
cd wallet-chat-app

# Install dependencies
npm install

# Copy example environment file and configure
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Set Up Supabase Database

1. Create a new Supabase project
2. Navigate to the SQL Editor
3. Execute the SQL schema from `db_schema_updates.sql`:

```sql
-- Add payment_address column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_address text;

-- Add verified flag to messages table to track messages with direct signatures
ALTER TABLE messages ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- Add to_address column to messages table if it doesn't exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_address text;

-- Create rate_limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  timestamp timestamptz NOT NULL
);

-- Enable Row-Level Security on rate_limits table
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only service role to access rate_limits
CREATE POLICY IF NOT EXISTS "Allow service role only" 
ON rate_limits 
FOR ALL 
TO service_role 
USING (true);

-- Enable Row-Level Security on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policy to allow insert to messages only if verified recently
CREATE POLICY IF NOT EXISTS "Allow message insert if verified recently"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.stake_address = messages.from
    AND users.last_verified > now() - interval '1 hour'
  )
);

-- Create policy to allow select on messages
CREATE POLICY IF NOT EXISTS "Allow select on messages"
ON messages
FOR SELECT
USING (true);

-- Create cleanup function for old rate limits
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE timestamp < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Add index for faster message lookups (optional)
CREATE INDEX IF NOT EXISTS messages_from_idx ON messages(from);
CREATE INDEX IF NOT EXISTS messages_to_idx ON messages(to);
CREATE INDEX IF NOT EXISTS users_stake_idx ON users(stake_address);
```

4. Verify the tables and policies are created properly

### 3. Update Code Files

Ensure all security-related files are updated:

1. **WalletIdentityContext.tsx** - Dual-address verification
2. **api/user/verify/route.ts** - Server-side verification endpoint
3. **api/message/route.ts** - Message handling with verification checks
4. **utils/verifySignature.ts** - Signature verification utilities

### 4. Test the Implementation

Run the verification script to check if everything is set up correctly:

```bash
# Install script dependencies
npm install @supabase/supabase-js readline

# Run the testing script
node setup-testing.js
```

Verify that all checks pass, including:
- Database schema verification
- Row-Level Security policies
- Rate limiting tables

### 5. Local Development

```bash
# Start development server
npm run dev
```

Test the following workflows:
1. Connect your Cardano wallet
2. Verify wallet identity
3. Send messages to your own address (for testing)
4. Test session persistence by refreshing the page
5. Test session expiration by manipulating the timestamp

### 6. Production Deployment

#### Option 1: Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel
```

Set the environment variables in the Vercel dashboard:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

#### Option 2: Self-Hosted Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

### 7. Security Verification

After deployment, perform these security checks:

1. **Authentication Test**:
   - Connect wallet and verify
   - Check both addresses are stored in database
   - Verify session persistence (refresh page)
   - Test session expiration (wait 1+ hour)

2. **Messaging Security**:
   - Try sending message without verification (should fail)
   - Verify and send message (should succeed)
   - Check rate limiting by sending multiple messages quickly

3. **Database Security**:
   - Attempt direct database access via Supabase client (should be protected by RLS)
   - Verify rate limit entries are created properly

## Troubleshooting

### Common Issues

#### Wallet Connection Problems
- Ensure the wallet extension is installed and up to date
- Check browser console for connection errors
- Verify the wallet implements CIP-30 standard

#### Verification Failures
- Check browser console for detailed error logs
- Verify message format matches what the wallet expects
- Ensure the wallet extension has necessary permissions

#### Database Errors
- Confirm SQL schema was applied correctly
- Check for missing columns or tables
- Verify RLS policies are active

#### API Errors
- Check server logs for detailed error messages
- Verify API route parameters and request format
- Ensure environment variables are set correctly

### Logging and Debugging

For production deployments, consider implementing:
1. Server-side logging for verification attempts
2. Error tracking via a service like Sentry
3. Monitoring for rate-limiting events
4. Regular security audits of the codebase

## Next Steps

After successful implementation, consider these enhancements:

1. **Real-time Updates**: Implement Supabase Realtime for live chat
2. **Message Pagination**: Add efficient loading for large message histories
3. **Contact Management**: Create an address book for frequent contacts
4. **Profile System**: Allow users to set display names and avatars

For advanced security, consider implementing:
1. **Per-message Verification**: Option for signing each message individually
2. **End-to-end Encryption**: Add an encryption layer for message contents
3. **Admin Tools**: Create moderation capabilities for community management

## Support

If you encounter issues not covered in this guide, check:
1. GitHub repository issues
2. Cardano developer documentation
3. Supabase documentation for database issues
4. Next.js documentation for frontend/API issues 