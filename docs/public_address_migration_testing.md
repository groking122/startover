# Public Address Migration Testing Guide

This guide provides steps to test and verify the public address migration has been implemented correctly.

## Prerequisites

- Database migration has been run
- Frontend and backend code has been updated
- Supabase DB access is configured properly

## Testing Steps

### 1. Run the Test Script

The test script verifies session management and database access with public addresses:

```bash
# Execute from project root
npx ts-node src/utils/tests/publicAddressTest.ts
```

Verify that all tests pass successfully.

### 2. Test User Creation and Verification

1. Clear your browser storage (to remove any existing sessions)
2. Connect a wallet in the application
3. Verify the wallet
4. Open the browser console and check that the primary address (public address) is being used

Expected console output:
```
✅ Using primary address: addr1...
✅ Restored verification from secure session using primary address
```

### 3. Test Database Entry

Check that the user entry in the database includes both stake address and public address:

```sql
-- Run in Supabase SQL Editor
SELECT stake_address, public_address, last_verified 
FROM users 
WHERE public_address IS NOT NULL 
ORDER BY last_verified DESC 
LIMIT 5;
```

### 4. Test Message Sending

1. Send a message to another user using either stake address or public address
2. Verify that the message is stored correctly with both addresses
3. Check the messages table:

```sql
-- Run in Supabase SQL Editor
SELECT 
  from_address, 
  from_public_address, 
  to_address, 
  to_public_address, 
  message 
FROM messages 
ORDER BY created_at DESC 
LIMIT 5;
```

### 5. Test Conversation Retrieval

1. Open the chat with the user you messaged
2. Verify that messages appear correctly
3. Check the browser's network requests during conversation loading
4. Confirm that the API is using `user_address` correctly

### 6. Test Backward Compatibility

1. Send a message to a user who hasn't migrated (stake address only)
2. Receive a message from a user who hasn't migrated
3. Verify that messages are correctly displayed in both directions

## Troubleshooting

### Session Issues

If session-related issues occur:
- Check browser console for errors
- Verify that sessionManager.ts is correctly handling both address types
- Check if localStorage has a valid wallet session

### Database Issues

If database-related issues occur:
- Verify that the database migration was run successfully
- Check for NULL values in critical fields
- Ensure RLS policies are correctly updated

### API Issues

If API-related issues occur:
- Check the middleware to ensure it's properly extracting wallet addresses
- Verify that API routes accept both stake and public addresses
- Check network requests in browser dev tools

## Post-Migration Monitoring

After completing the migration, monitor:

1. Authentication success rates
2. Message delivery rates 
3. Database query performance
4. Any errors related to address handling

Use the Supabase dashboard to monitor query performance and error rates.

## Rollback Plan

If critical issues are encountered:

1. Revert API changes to use only stake addresses
2. Update the middleware to only use x-stake-address
3. Keep the database schema changes (they are backward compatible)

Run the following command to revert to stake-address-only mode:

```bash
git checkout [pre-migration-commit] -- src/app/api/
git checkout [pre-migration-commit] -- src/middleware/
``` 