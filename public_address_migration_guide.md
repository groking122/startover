# Public Address Migration Guide

This guide outlines the steps to migrate the Cardano wallet chat app from stake address-based authentication to public address-based authentication.

## Overview

The migration involves updating several components of the application:

1. Frontend wallet connection and authentication
2. Database schema and functions
3. API endpoints
4. Type definitions

## Migration Steps

### 1. Database Migration

First, execute the database migration script to add public address fields to the database:

```sql
-- Run the migration script
\i db_migration_public_address.sql
```

This script will:
- Add public_address columns to the users table
- Add from_public_address and to_public_address columns to the messages table
- Create appropriate indexes
- Update RLS policies
- Create a migration function to populate public address fields from existing data

### 2. Update Database Functions

Replace the existing database functions with the updated versions:

```sql
-- Update the get_user_conversations function
\i src/db/functions/get_user_conversations_updated.sql

-- Update the get_unread_counts_by_sender function
\i src/db/functions/get_unread_counts_by_sender_updated.sql
```

### 3. Frontend Updates

Deploy the updated frontend components:

1. WalletIdentityContext.tsx - Updated to prioritize public addresses
2. Types and interfaces - Updated to include public address fields

### 4. API Updates

Deploy the updated API endpoints:

1. message/route.ts - Updated to handle public addresses
2. conversations/route.ts - Updated to use the new database functions
3. message/unread-count/route.ts - Updated to check both stake and public addresses
4. message/read/route.ts - Updated to mark messages as read using public addresses

### 5. Testing

Test the migration with the following scenarios:

1. **New User Registration**:
   - Connect a new wallet
   - Verify that the public address is used for authentication
   - Send and receive messages

2. **Existing User Migration**:
   - Log in with an existing wallet
   - Verify that the user can still access their conversations
   - Check that new messages use public addresses

3. **Mixed Conversations**:
   - Test conversations between users with different authentication methods
   - Verify that messages can be sent between stake address and public address users

### 6. Monitoring

After deployment, monitor the following:

1. Authentication success rates
2. Message delivery success rates
3. Database query performance
4. Any errors related to address handling

## Rollback Plan

If issues are encountered, the following rollback steps can be taken:

1. Revert the API endpoints to the previous versions
2. Revert the frontend components to use stake addresses
3. Keep the database schema changes (they are backward compatible)

## Security Considerations

The migration to public addresses provides several security benefits:

1. **Reduced Impersonation Risk**: Public addresses are unique to specific UTXOs, making impersonation more difficult.
2. **Stronger Authentication**: Users must prove control of the specific public address.
3. **Better Privacy**: Users can use different public addresses for different contexts.

For more details on security benefits, refer to the `public_address_authentication.md` document.

## Timeline

Suggested implementation timeline:

1. **Phase 1 (Week 1)**: Database migration and testing
2. **Phase 2 (Week 2)**: API updates and testing
3. **Phase 3 (Week 3)**: Frontend updates and testing
4. **Phase 4 (Week 4)**: Full system testing and deployment

## Conclusion

This migration significantly improves the security of the Cardano wallet chat app by using public addresses for authentication while maintaining backward compatibility with existing users.