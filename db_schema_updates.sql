-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  stake_address text UNIQUE NOT NULL,
  payment_address text,
  public_key text,
  last_verified timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable Row-Level Security on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage users
CREATE POLICY IF NOT EXISTS "Allow service role to manage users" 
ON users 
FOR ALL 
TO service_role 
USING (true);

-- Create policy to allow users to view their own data
CREATE POLICY IF NOT EXISTS "Allow users to view their own data"
ON users
FOR SELECT
USING (auth.uid()::text = stake_address);

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