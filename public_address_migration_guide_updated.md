# Public Address Migration Guide: Stake Address Removal

This guide outlines the steps to migrate the Cardano wallet chat app from supporting both stake and public addresses to using **only public addresses** for authentication and identification.

## Overview

The migration involves updating several components of the application:

1. Database schema and functions
2. Middleware and session validation
3. API endpoints
4. Frontend components
5. User migration

## Migration Steps

### 1. Database Migration

First, execute the database migration script to update schemas and migrate existing users:

```sql
-- Run the migration script
\i db_migration_public_only.sql
```

This script will:
- Migrate all users without public addresses to have one (derived from stake address)
- Update messages to use public address fields
- Modify RLS policies to only use public address fields
- Create new database functions that only work with public addresses
- Add appropriate indexes for public address fields

### 2. API and Middleware Updates

Deploy the updated API and middleware components:

1. **Session Validation**:
   - `src/middleware/sessionValidation.ts` - Modified to only validate public addresses
   - Removed `getValidatedStakeAddress` function

2. **User Verification**:
   - `src/app/api/user/verify/route.ts` - Modified to require public addresses

3. **Message API**:
   - `src/app/api/message/route.ts` - Updated to only use public address fields
   - Removed stake address code paths

4. **Conversations API**:
   - `src/app/api/conversations/route.ts` - Updated to only use public address queries

5. **Address Utilities**:
   - `src/utils/addressUtils.ts` - Added utility functions for public addresses

### 3. Frontend Updates

Deploy the updated frontend components:

1. **Session Management**:
   - `src/utils/sessionManager.ts` - Updated to only store public addresses

2. **Wallet Identity Context**:
   - `src/contexts/WalletIdentityContext.tsx` - Removed stake address state and methods
   - Modified to only use public addresses

3. **Components**:
   - Update all UI components to display public addresses
   - Remove any stake address display logic

### 4. User Migration

For existing users, the system handles migration automatically:

1. **For Active Users**:
   - Upon next login, both stake and public addresses are captured
   - Verification process will associate stake addresses with public addresses

2. **For Inactive Users**:
   - The migration script creates derived public addresses
   - When they reconnect, their actual public address will update automatically

### 5. Testing

Test the migration with the following scenarios:

1. **New User Registration**:
   - Connect a new wallet
   - Verify that only public address is used
   - Send and receive messages

2. **Existing User Login**:
   - Log in with an existing wallet
   - Verify proper migration of conversations and messages
   - Check that new messages use public addresses

3. **Message Sending/Receiving**:
   - Verify messages can be sent between users
   - Confirm unread counts work correctly
   - Test conversation listing

### 6. Monitoring

After deployment, monitor the following:

1. Authentication success rates
2. Message delivery success rates
3. Database query performance
4. Any errors related to address handling

## Security Improvements

This migration provides several security benefits:

1. **Stronger Authentication**: Public addresses are unique to specific UTXOs, providing better proof of wallet control.
2. **Reduced Impersonation Risk**: Users must prove control of the specific public address they use.
3. **Better Privacy**: Users can use different public addresses for different contexts.
4. **Simpler Code**: Eliminating dual-address support reduces complexity and potential bugs.

## Future Steps

After successful migration:

1. **Schema Cleanup**: After a suitable transition period (30-60 days), remove stake address columns from database.
2. **Code Cleanup**: Remove any remaining legacy code related to stake addresses.
3. **Performance Optimization**: Optimize queries that were designed for dual-address support.

## Conclusion

This migration significantly improves the security of the Cardano wallet chat app by using public addresses for authentication while providing a smooth transition for existing users. 