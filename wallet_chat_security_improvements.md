# Cardano Wallet Chat Security Improvements

This guide outlines the security improvements implemented in the Cardano wallet-based chat application to fix vulnerabilities and enhance the overall authentication and verification system.

## Key Vulnerabilities Addressed

1. **Stake Address Impersonation**
   - **Problem**: Using only stake addresses for authentication created a vulnerability for flanken addresses (multiple wallets sharing the same stake address).
   - **Solution**: Now storing and verifying both stake and payment addresses.

2. **Frontend Verification Bypass**
   - **Problem**: Verification checks performed on the frontend could be bypassed.
   - **Solution**: Added strict server-side verification in API endpoints.

3. **Session Timeout Issues**
   - **Problem**: 30-second disconnection after verification, requiring refresh.
   - **Solution**: Improved session management with proper expiration handling.

4. **Missing Per-Message Verification**
   - **Problem**: Messages weren't individually verified.
   - **Solution**: Added optional per-message signature verification.

## Implementation Steps

### 1. Database Schema Updates

Execute the following SQL in your Supabase SQL editor:

```sql
-- See db_schema_updates.sql for all updates
```

**Key Schema Changes:**
- Added `payment_address` to users table
- Added `verified` flag to messages table
- Added `to_address` to messages table
- Created `rate_limits` table with Row-Level Security
- Added Row-Level Security policies to messages table

### 2. Authentication Flow Changes

#### Verification Now Includes Both Addresses:
- Stake address is used for account identification
- Payment address adds another layer of security

#### Two Verification Approaches:
1. **Session-Based** (default):
   - Verify once, valid for 1 hour
   - Server checks verification timestamp

2. **Per-Message** (optional):
   - Each message can include a signature
   - Higher security, more wallet interactions

### 3. Frontend Improvements

#### Wallet Context Updates:
- Added payment address tracking
- Added verification expiration logic
- Improved disconnection handling

#### Local Storage:
- Added timestamp to verification cache
- Added expiration checks on load and during checks

### 4. Backend Security Improvements

#### API Routes:
- `/api/user/verify`: Now validates and stores both addresses
- `/api/message`: Added two-tier validation (session or signature-based)

#### Rate Limiting:
- Added Supabase-based rate limiting for verification attempts
- Added message rate limiting to prevent spam

#### Row-Level Security:
- Ensures only verified users can insert messages
- Protects rate limiting tables from unauthorized access

## Testing Your Implementation

1. **Verify Wallet Integration**:
   - Connect your wallet
   - Verify the wallet
   - Check both addresses are stored

2. **Test Verification Persistence**:
   - Verify and wait 30 seconds (no disconnection should occur)
   - Refresh the page (should still be verified)
   - Wait over 1 hour (should require re-verification)

3. **Test Message Security**:
   - Try sending without verification (should fail)
   - Verify and send (should succeed)
   - Wait over 1 hour and try again (should prompt for verification)

## Future Improvements

1. **Realtime Updates**: Implement Supabase Realtime or polling for live chat updates.
2. **Message Pagination**: Add pagination for efficiently loading large chat histories.
3. **Admin Tools**: Create tools for banning malicious stake addresses.
4. **Notifications**: Add notification support for new messages.

## Troubleshooting

- **Wallet Connection Issues**: Ensure wallet extension is up-to-date
- **Verification Failures**: Check browser console for detailed error messages
- **Database Errors**: Confirm SQL schema updates were applied correctly

For issues, refer to the console logs for detailed diagnostics. 