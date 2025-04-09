CREATE OR REPLACE FUNCTION public.get_unread_counts_by_sender(user_address TEXT)
RETURNS TABLE (
  from_address TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    messages.from_address,
    COUNT(messages.id)::BIGINT
  FROM messages
  WHERE 
    messages.to_address = user_address AND 
    messages.is_read = FALSE
  GROUP BY messages.from_address
  ORDER BY COUNT(messages.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 