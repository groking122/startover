-- Migration script to transition from stake addresses to public addresses only
-- This script performs the following operations:
-- 1. Updates RLS policies to only use public addresses
-- 2. Migrates existing users to ensure they have public addresses
-- 3. Updates message fields to prioritize public addresses
-- 4. Adds indexes for public address fields

-- Create a function to migrate existing stake addresses to public addresses
CREATE OR REPLACE FUNCTION migrate_to_public_only() RETURNS void AS $$
DECLARE
    user_rec RECORD;
    random_suffix TEXT;
BEGIN
    -- First, check that all users have public addresses
    FOR user_rec IN 
        SELECT id, stake_address 
        FROM public.users 
        WHERE public_address IS NULL OR public_address = ''
    LOOP
        -- Generate a deterministic but unique public address based on stake address
        -- In a real migration, you would derive the actual public address from the stake address
        -- This is just a placeholder for demonstration purposes
        random_suffix := substr(md5(user_rec.stake_address), 1, 48);
        
        UPDATE public.users
        SET public_address = CASE 
            WHEN substr(stake_address, 1, 6) = 'stake1' THEN 'addr1' || random_suffix
            ELSE 'addr_test1' || random_suffix
        END
        WHERE id = user_rec.id;
        
        RAISE NOTICE 'Migrated user % from stake address % to a public address', 
            user_rec.id, substr(user_rec.stake_address, 1, 10) || '...';
    END LOOP;
    
    -- Update messages table to fill in missing public address fields
    UPDATE public.messages m
    SET from_public_address = u.public_address
    FROM public.users u
    WHERE m.from_address = u.stake_address
    AND (m.from_public_address IS NULL OR m.from_public_address = '');
    
    UPDATE public.messages m
    SET to_public_address = u.public_address
    FROM public.users u
    WHERE m.to_address = u.stake_address
    AND (m.to_public_address IS NULL OR m.to_public_address = '');
    
    RAISE NOTICE 'Migration to public addresses completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Start transaction
BEGIN;

-- Update RLS policies to use public addresses only
-- First, drop the existing policies
DROP POLICY IF EXISTS users_policy ON public.users;
DROP POLICY IF EXISTS users_admin_policy ON public.users;
DROP POLICY IF EXISTS messages_policy ON public.messages;
DROP POLICY IF EXISTS messages_admin_policy ON public.messages;

-- Create new policies that only use public addresses
CREATE POLICY users_policy ON public.users
    USING (public_address = current_user);

CREATE POLICY users_admin_policy ON public.users
    USING (current_user = 'authenticated');

CREATE POLICY messages_policy ON public.messages
    USING (from_public_address = current_user OR to_public_address = current_user);

CREATE POLICY messages_admin_policy ON public.messages
    USING (current_user = 'authenticated');

-- Create or replace function for getting unread messages
CREATE OR REPLACE FUNCTION get_unread_messages_count(user_public_address TEXT)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.messages
    WHERE to_public_address = user_public_address
    AND is_read = FALSE;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Create or replace function for getting conversations
CREATE OR REPLACE FUNCTION get_user_conversations(user_public_address TEXT)
RETURNS TABLE (
    partner_address TEXT,
    last_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH conversation_partners AS (
        -- Get distinct partners from messages where user is either sender or recipient
        SELECT DISTINCT
            CASE 
                WHEN from_public_address = user_public_address THEN to_public_address
                ELSE from_public_address
            END AS partner
        FROM public.messages
        WHERE from_public_address = user_public_address OR to_public_address = user_public_address
    ),
    last_messages AS (
        -- Get the most recent message for each conversation
        SELECT DISTINCT ON (
            CASE 
                WHEN from_public_address = user_public_address THEN to_public_address
                ELSE from_public_address
            END
        )
            CASE 
                WHEN from_public_address = user_public_address THEN to_public_address
                ELSE from_public_address
            END AS partner,
            message AS content,
            created_at
        FROM public.messages
        WHERE from_public_address = user_public_address OR to_public_address = user_public_address
        ORDER BY partner, created_at DESC
    ),
    unread_counts AS (
        -- Count unread messages for each partner
        SELECT 
            from_public_address AS partner,
            COUNT(*) AS unread
        FROM public.messages
        WHERE to_public_address = user_public_address
        AND is_read = FALSE
        GROUP BY from_public_address
    )
    
    -- Join everything together
    SELECT 
        cp.partner,
        lm.content,
        lm.created_at,
        COALESCE(uc.unread, 0) AS unread_count
    FROM conversation_partners cp
    LEFT JOIN last_messages lm ON cp.partner = lm.partner
    LEFT JOIN unread_counts uc ON cp.partner = uc.partner
    ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the migration function
SELECT migrate_to_public_only();

-- Create or update indexes for public addresses
DROP INDEX IF EXISTS idx_messages_from_public_address;
DROP INDEX IF EXISTS idx_messages_to_public_address;
DROP INDEX IF EXISTS idx_users_public_address;

CREATE INDEX IF NOT EXISTS idx_messages_from_public_address ON public.messages (from_public_address);
CREATE INDEX IF NOT EXISTS idx_messages_to_public_address ON public.messages (to_public_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_address ON public.users (public_address);

-- Commit transaction
COMMIT;

-- Note: In a future migration, we can drop the stake_address columns, but we'll keep them
-- for now to ensure backward compatibility during the transition period 