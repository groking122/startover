# Public Address Authentication in Cardano Wallet Chat App

## Overview

This document outlines the migration from stake address-based authentication to public address-based authentication in our Cardano wallet chat app. This change significantly improves security by using unique public addresses for user identification instead of shared stake addresses.

## Background

### Stake Addresses vs. Public Addresses

1. **Stake Addresses**
   - A stake address is shared across all addresses in a wallet
   - Format: starts with `stake1`
   - Used for staking and delegation
   - All transactions from the same wallet share the same stake address

2. **Public Addresses (Payment/Base Addresses)**
   - Unique addresses generated for each transaction
   - Format: starts with `addr1` (mainnet) or `addr_test1` (testnet)
   - Used for sending and receiving funds
   - Each wallet can have many public addresses

## Security Vulnerability with Stake Addresses

Using stake addresses for authentication creates a significant security vulnerability:

1. **Impersonation Risk**: Since stake addresses are publicly visible on the blockchain, anyone can see which stake address owns which assets. This makes it possible for an attacker to claim they own a stake address without actually controlling it.

2. **Lack of Uniqueness**: All addresses in a wallet share the same stake address, making it impossible to distinguish between different users who might have access to the same wallet.

3. **Blockchain Privacy Issues**: Using stake addresses for identification links all user activity to a publicly visible identifier on the blockchain.

## Security Benefits of Public Addresses

Switching to public address-based authentication provides several security improvements:

1. **Unique Identification**: Public addresses are unique to specific UTXOs, providing a more granular level of identification.

2. **Proof of Ownership**: To use a public address for authentication, a user must prove they control the private key for that specific address, which is a stronger verification method.

3. **Reduced Impersonation Risk**: An attacker would need to know both the public address and have access to the corresponding private key to impersonate a user.

4. **Better Privacy**: Users can use different public addresses for different contexts, improving privacy.

5. **Future-Proof**: This approach aligns better with Cardano's design principles and future developments in the ecosystem.

## Implementation Details

The migration to public address-based authentication includes the following changes:

1. **Database Schema Updates**:
   - Added `public_address` column to the `users` table
   - Added `from_public_address` and `to_public_address` columns to the `messages` table
   - Updated indexes and RLS policies to work with public addresses

2. **Authentication Flow**:
   - Modified wallet connection to prioritize public addresses over stake addresses
   - Updated verification process to sign messages with public addresses
   - Enhanced session management to store and validate public addresses

3. **API Changes**:
   - Updated message sending/receiving to work with public addresses
   - Modified conversation queries to handle public address identifiers
   - Added backward compatibility for existing stake address-based accounts

4. **Frontend Updates**:
   - Updated UI components to display public addresses appropriately
   - Modified wallet connection flow to retrieve and use public addresses

## Migration Path

The system maintains backward compatibility with stake addresses while prioritizing public addresses:

1. **New Users**: Will automatically use public address-based authentication
2. **Existing Users**: Will continue to work with stake addresses but will transition to public addresses upon their next wallet connection
3. **Database Migration**: A migration script populates public address fields from existing data

## Conclusion

By transitioning from stake addresses to public addresses for authentication, our Cardano wallet chat app significantly improves security and reduces the risk of impersonation attacks. This change aligns with best practices in blockchain authentication while maintaining backward compatibility for existing users.