# Database Migration Plan: Update to Payment Addresses

This document outlines the steps needed to migrate the database from using stake addresses to payment addresses for wallet verification and message routing.

## 1. Update the `users` Table

1. Add new columns:
   ```sql
   ALTER TABLE users
   ADD COLUMN payment_address TEXT UNIQUE;
   ```

2. Create a trigger to enforce uniqueness:
   ```sql
   CREATE UNIQUE INDEX users_payment_address_idx ON users(payment_address);
   ```

## 2. Update the `messages` Table

1. Add new columns for payment addresses:
   ```sql
   ALTER TABLE messages
   ADD COLUMN payment_address_from TEXT,
   ADD COLUMN payment_address_to TEXT,
   ADD COLUMN signature JSONB;
   ```

2. Create indexes for quicker lookups:
   ```sql
   CREATE INDEX messages_payment_address_from_idx ON messages(payment_address_from);
   CREATE INDEX messages_payment_address_to_idx ON messages(payment_address_to);
   ```

## 3. Data Migration Steps

For an in-place migration, follow these steps carefully:

1. Create a backup of your database first:
   ```bash
   # Using the Supabase CLI
   supabase db dump -f before_migration.sql
   ```

2. Migrate existing users (if you have user records and want to preserve them):
   ```sql
   -- This is a placeholder - you'll need to implement a way to 
   -- match stake addresses to payment addresses for each user
   -- This might require application-level logic to connect the wallet
   -- and retrieve both stake and payment addresses
   ```

3. Migrate existing messages (if you want to preserve message history):
   ```sql
   -- Temporary migration for demonstration purposes
   -- In a real migration, you'd need a mapping of stake to payment addresses
   UPDATE messages
   SET payment_address_from = from,
       payment_address_to = to_address
   WHERE to_address IS NOT NULL;
   ```

4. Validation steps:
   - Verify all users have a payment_address 
   - Verify all messages have payment_address_from and payment_address_to values
   - Test the application with the new schema

## 4. Post-Migration Cleanup (After Testing)

Once the migration is confirmed working:

1. Remove old columns (optional - can be done later if needed):
   ```sql
   ALTER TABLE users
   DROP COLUMN stake_address;

   ALTER TABLE messages
   DROP COLUMN from,
   DROP COLUMN to,
   DROP COLUMN to_address;
   ```

## 5. Important Application Changes

1. Update verification endpoints to use payment_address
2. Update message sending and retrieval to use payment addresses
3. Update inbox/conversation fetching to use payment addresses

## 6. Rollback Plan

If issues occur, the following SQL can be used to restore the previous state:

```sql
-- Restore from backup
-- supabase db restore before_migration.sql
``` 