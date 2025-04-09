-- Function to get conversations for a user
-- This returns all unique conversation partners with the most recent message
CREATE OR REPLACE FUNCTION public.get_conversations(user_address TEXT)
RETURNS TABLE (
  partner_address TEXT,
  last_message TEXT,
  last_message_id UUID,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT,
  is_partner_verified BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH conversations AS (
    -- Get all conversations where the user is either sender or recipient
    SELECT 
      CASE 
        WHEN from_address = user_address THEN to_address 
        ELSE from_address 
      END AS partner_address,
      message,
      id AS message_id,
      created_at,
      CASE
        WHEN to_address = user_address AND NOT is_read THEN 1
        ELSE 0
      END AS unread
    FROM messages
    WHERE from_address = user_address OR to_address = user_address
  ),
  latest_messages AS (
    -- Get most recent message for each conversation
    SELECT 
      partner_address,
      message AS last_message,
      message_id AS last_message_id,
      created_at AS last_message_time,
      ROW_NUMBER() OVER (PARTITION BY partner_address ORDER BY created_at DESC) AS rn
    FROM conversations
  ),
  unread_counts AS (
    -- Count unread messages per conversation
    SELECT 
      partner_address,
      SUM(unread) AS unread_count
    FROM conversations
    GROUP BY partner_address
  )
  -- Join everything together
  SELECT 
    lm.partner_address,
    lm.last_message,
    lm.last_message_id,
    lm.last_message_time,
    COALESCE(uc.unread_count, 0) AS unread_count,
    u.last_verified IS NOT NULL AS is_partner_verified
  FROM latest_messages lm
  LEFT JOIN unread_counts uc ON lm.partner_address = uc.partner_address
  LEFT JOIN users u ON lm.partner_address = u.stake_address
  WHERE lm.rn = 1
  ORDER BY lm.last_message_time DESC;
END;
$$; 