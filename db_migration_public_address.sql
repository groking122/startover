-- Migration script to update database schema to use public addresses instead of stake addresses
-- This script adds support for public addresses while maintaining backward compatibility

-- 1. Add public_address column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_address text;

-- 2. Create index on public_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_public_address ON users(public_address);

-- 3. Update RLS policies to check public_address as well as stake_address
DROP POLICY IF EXISTS "Allow users to view their own data" ON users;
CREATE POLICY "Allow users to view their own data"
ON users
FOR SELECT
USING (auth.uid()::text = stake_address OR auth.uid()::text = public_address);

DROP POLICY IF EXISTS "Allow users to update their own data" ON users;
CREATE POLICY "Allow users to update their own data"
ON users
FOR UPDATE
USING (auth.uid()::text = stake_address OR auth.uid()::text = public_address);

-- 4. Add from_public_address and to_public_address columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_public_address text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_public_address text;

-- 5. Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_messages_from_public_address ON messages(from_public_address);
CREATE INDEX IF NOT EXISTS idx_messages_to_public_address ON messages(to_public_address);
CREATE INDEX IF NOT EXISTS idx_messages_public_conversation ON messages(from_public_address, to_public_address);

-- 6. Update RLS policies for messages to include public addresses
DROP POLICY IF EXISTS "Allow message insert if verified recently" ON messages;
CREATE POLICY "Allow message insert if verified recently"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE (users.stake_address = messages.from OR users.public_address = messages.from_public_address)
    AND users.last_verified > now() - interval '1 hour'
  )
);

DROP POLICY IF EXISTS "Allow users to view messages sent to them" ON messages;
CREATE POLICY "Allow users to view messages sent to them"
ON messages
FOR SELECT
USING (
  messages.to = auth.uid()::text OR 
  messages.from = auth.uid()::text OR
  messages.to_public_address = auth.uid()::text OR
  messages.from_public_address = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow users to update their own messages" ON messages;
CREATE POLICY "Allow users to update their own messages"
ON messages
FOR UPDATE
USING (messages.from = auth.uid()::text OR messages.from_public_address = auth.uid()::text);

DROP POLICY IF EXISTS "Allow users to delete their own messages" ON messages;
CREATE POLICY "Allow users to delete their own messages"
ON messages
FOR DELETE
USING (messages.from = auth.uid()::text OR messages.from_public_address = auth.uid()::text);

-- 7. Create a function to populate public address fields from existing data (one-time migration)
CREATE OR REPLACE FUNCTION migrate_to_public_addresses()
RETURNS void AS $$
BEGIN
  -- Update users table where public_address is null but payment_address exists
  UPDATE users
  SET public_address = payment_address
  WHERE public_address IS NULL AND payment_address IS NOT NULL;
  
  -- Update messages table to populate from_public_address based on existing data
  UPDATE messages m
  SET from_public_address = u.public_address
  FROM users u
  WHERE m.from = u.stake_address
  AND m.from_public_address IS NULL
  AND u.public_address IS NOT NULL;
  
  -- Update messages table to populate to_public_address based on existing data
  UPDATE messages m
  SET to_public_address = u.public_address
  FROM users u
  WHERE m.to = u.stake_address
  AND m.to_public_address IS NULL
  AND u.public_address IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT migrate_to_public_addresses();