CREATE OR REPLACE FUNCTION public.get_user_conversations(user_address TEXT, messages_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  partner_address TEXT,
  last_message TEXT,
  last_timestamp TIMESTAMPTZ,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY 
  WITH conversations AS (
    -- Find all conversations where user is involved (either sender or recipient)
    SELECT 
      CASE 
        WHEN from_address = user_address THEN to_address
        ELSE from_address
      END AS partner,
      MAX(created_at) AS latest_timestamp
    FROM messages
    WHERE from_address = user_address OR to_address = user_address
    GROUP BY partner
    ORDER BY latest_timestamp DESC
    LIMIT messages_limit
  ),
  last_messages AS (
    -- Get the most recent message for each conversation
    SELECT 
      c.partner,
      m.message AS last_message,
      m.created_at AS last_timestamp
    FROM conversations c
    JOIN messages m ON (
      (m.from_address = user_address AND m.to_address = c.partner) OR
      (m.from_address = c.partner AND m.to_address = user_address)
    )
    WHERE m.created_at = c.latest_timestamp
  ),
  unread_counts AS (
    -- Count unread messages in each conversation
    SELECT
      from_address AS partner,
      COUNT(*) AS unread_count
    FROM messages
    WHERE to_address = user_address AND is_read = FALSE
    GROUP BY from_address
  )
  
  -- Combine the results
  SELECT
    lm.partner AS partner_address,
    lm.last_message,
    lm.last_timestamp,
    COALESCE(uc.unread_count, 0) AS unread_count
  FROM last_messages lm
  LEFT JOIN unread_counts uc ON lm.partner = uc.partner
  ORDER BY lm.last_timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 