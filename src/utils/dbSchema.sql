-- Messages Table Schema
-- Used for storing messages between users

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_address TEXT NOT NULL REFERENCES public.users(stake_address),
  to_address TEXT NOT NULL REFERENCES public.users(stake_address),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  signature TEXT,
  public_key TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_from_address ON public.messages(from_address);
CREATE INDEX IF NOT EXISTS idx_messages_to_address ON public.messages(to_address);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(from_address, to_address);

-- Add RLS policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only send messages as themselves
CREATE POLICY messages_insert_policy ON public.messages
  FOR INSERT
  WITH CHECK (from_address = auth.uid());

-- Policy: Users can only view messages sent to them or by them
CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT
  USING (from_address = auth.uid() OR to_address = auth.uid());

-- Policy: Users can only update their own messages (e.g., mark as read)
CREATE POLICY messages_update_policy ON public.messages
  FOR UPDATE
  USING (from_address = auth.uid() OR to_address = auth.uid());

-- Rate Limiting Table Schema
-- Used for tracking API rate limits

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 1,
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits(reset_at);

-- Add RLS policies for rate limits (only accessible by service)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow the service to manage rate limits
CREATE POLICY rate_limits_service_policy ON public.rate_limits
  USING (auth.role() = 'service'); 