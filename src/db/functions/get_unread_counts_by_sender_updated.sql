CREATE OR REPLACE FUNCTION public.get_unread_counts_by_sender(user_address TEXT)
RETURNS TABLE (
  from_address TEXT,
  from_public_address TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY 
  WITH unread_messages AS (
    -- Get unread messages where user is the recipient
    -- Include both stake address and public address cases
    SELECT 
      messages.from_address,
      messages.from_public_address,
      messages.id
    FROM messages
    WHERE 
      (messages.to_address = user_address OR messages.to_public_address = user_address) AND 
      messages.is_read = FALSE
  )
  
  SELECT 
    um.from_address,
    um.from_public_address,
    COUNT(um.id)::BIGINT
  FROM unread_messages um
  GROUP BY um.from_address, um.from_public_address
  ORDER BY COUNT(um.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;