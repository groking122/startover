# Public Address Migration Deployment Checklist

This checklist ensures all necessary steps are completed for migrating from stake address-based authentication to public address-based authentication.

## Pre-Deployment

- [ ] Review code changes for security issues
- [ ] Test all changes in development environment
- [ ] Run the automated test script (`src/utils/tests/publicAddressTest.ts`)
- [ ] Prepare database backup before migration

## Database Migration

- [ ] Deploy the database migration script:
  - [ ] Run `db_migration_public_address.sql` on production database
  - [ ] Verify columns were added successfully (`public_address` in users table)
  - [ ] Verify indexes were created correctly
  - [ ] Verify RLS policies were updated

## Code Deployment

- [ ] Deploy updated API endpoints:
  - [ ] Conversation API
  - [ ] Message API
  - [ ] User verification API
  
- [ ] Deploy updated middleware:
  - [ ] Session validation middleware
  
- [ ] Deploy updated frontend components:
  - [ ] WalletIdentityContext
  - [ ] Session management utilities

## Post-Deployment Verification

- [ ] Verify user creation works with public addresses
- [ ] Verify message sending works with both address types
- [ ] Verify conversation retrieval works with both address types
- [ ] Check performance metrics for any degradation

## Monitoring

- [ ] Set up alerts for:
  - [ ] Failed authentication attempts
  - [ ] Failed message deliveries
  - [ ] Database query errors
  
- [ ] Monitor logs for unexpected errors
- [ ] Track usage metrics to confirm successful adoption

## Rollback Plan

If critical issues are detected:

1. Revert API changes to use only stake addresses
2. Update middleware to extract only stake addresses
3. Keep database changes (they are backward compatible)

```bash
git checkout [pre-migration-commit] -- src/app/api/
git checkout [pre-migration-commit] -- src/middleware/
```

## Final Steps

- [ ] Document any issues encountered during deployment
- [ ] Update product documentation to reflect changes
- [ ] Communicate changes to users if necessary 