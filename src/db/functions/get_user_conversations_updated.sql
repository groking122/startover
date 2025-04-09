CREATE OR REPLACE FUNCTION public.get_user_conversations(user_address TEXT, messages_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  partner_address TEXT,
  partner_public_address TEXT,
  last_message TEXT,
  last_message_id UUID,
  last_timestamp TIMESTAMPTZ,
  unread_count BIGINT,
  is_partner_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY 
  WITH conversations AS (
    -- Find all conversations where user is involved (either sender or recipient)
    -- Now includes public address fields
    SELECT 
      CASE 
        WHEN from_address = user_address THEN to_address
        WHEN to_address = user_address THEN from_address
        WHEN from_public_address = user_address THEN to_public_address
        WHEN to_public_address = user_address THEN from_public_address
        ELSE NULL
      END AS partner,
      CASE 
        WHEN from_address = user_address THEN to_public_address
        WHEN to_address = user_address THEN from_public_address
        WHEN from_public_address = user_address THEN to_address
        WHEN to_public_address = user_address THEN from_address
        ELSE NULL
      END AS partner_public,
      MAX(created_at) AS latest_timestamp
    FROM messages
    WHERE 
      from_address = user_address OR 
      to_address = user_address OR
      from_public_address = user_address OR
      to_public_address = user_address
    GROUP BY partner, partner_public
    ORDER BY latest_timestamp DESC
    LIMIT messages_limit
  ),
  last_messages AS (
    -- Get the most recent message for each conversation
    SELECT 
      c.partner,
      c.partner_public,
      m.id AS message_id,
      m.message AS last_message,
      m.created_at AS last_timestamp
    FROM conversations c
    JOIN messages m ON (
      (m.from_address = user_address AND m.to_address = c.partner) OR
      (m.from_address = c.partner AND m.to_address = user_address) OR
      (m.from_public_address = user_address AND m.to_public_address = c.partner_public) OR
      (m.from_public_address = c.partner_public AND m.to_public_address = user_address) OR
      -- Mixed combinations
      (m.from_address = user_address AND m.to_public_address = c.partner_public) OR
      (m.from_public_address = c.partner_public AND m.to_address = user_address) OR
      (m.from_public_address = user_address AND m.to_address = c.partner) OR
      (m.from_address = c.partner AND m.to_public_address = user_address)
    )
    WHERE m.created_at = c.latest_timestamp
  ),
  unread_counts AS (
    -- Count unread messages in each conversation
    SELECT
      CASE
        WHEN to_address = user_address THEN from_address
        WHEN to_public_address = user_address THEN from_public_address
        ELSE NULL
      END AS partner,
      CASE
        WHEN to_address = user_address THEN from_public_address
        WHEN to_public_address = user_address THEN from_address
        ELSE NULL
      END AS partner_public,
      COUNT(*) AS unread_count
    FROM messages
    WHERE (to_address = user_address OR to_public_address = user_address) AND is_read = FALSE
    GROUP BY partner, partner_public
  ),
  partner_verification AS (
    -- Check if partners are verified users
    SELECT
      u.stake_address AS partner_address,
      u.public_address AS partner_public_address,
      u.last_verified IS NOT NULL AND u.last_verified > NOW() - INTERVAL '24 hours' AS is_verified
    FROM users u
  )
  
  -- Combine the results
  SELECT
    lm.partner AS partner_address,
    lm.partner_public AS partner_public_address,
    lm.last_message,
    lm.message_id AS last_message_id,
    lm.last_timestamp,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(pv.is_verified, FALSE) AS is_partner_verified
  FROM last_messages lm
  LEFT JOIN unread_counts uc ON 
    (lm.partner = uc.partner) OR 
    (lm.partner_public = uc.partner_public)
  LEFT JOIN partner_verification pv ON 
    (lm.partner = pv.partner_address) OR 
    (lm.partner_public = pv.partner_public_address)
  ORDER BY lm.last_timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;