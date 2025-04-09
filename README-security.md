# Cardano Wallet Chat Security

## Overview

The Cardano Wallet Chat app allows users to securely communicate using their Cardano blockchain wallets for authentication. This implementation uses a combination of stake addresses and payment addresses to provide a robust identity verification system.

## Key Security Features

### Dual-Address Authentication

Our chat app uses both stake and payment addresses for a more secure authentication system:

- **Stake Address**: Used as the primary identifier for user accounts
- **Payment Address**: Adds a second layer of security to prevent flanken address attacks

### Verification Methods

Two methods of verification are supported:

1. **Session-Based Verification**:
   - Verify once with your wallet
   - Valid for 1 hour
   - Minimizes wallet interactions

2. **Per-Message Verification** (optional):
   - Each message can be individually signed
   - Provides the highest level of security
   - Requires more wallet interactions

### Security Measures

- **Row-Level Security**: Database-level protection for your messages
- **Rate Limiting**: Protection against verification and message spam
- **Server-Side Verification**: All authentication is verified on the backend
- **Session Expiration**: Automatic expiration of sessions after 1 hour
- **Signature Validation**: Cryptographic verification of wallet signatures

## How It Works

1. **Connect**: Connect your Cardano wallet (Eternl, Nami, Flint, etc.)
2. **Verify**: Sign a message with your wallet to prove ownership
3. **Chat**: Send messages to any stake address securely
4. **Stay Secure**: Sessions expire automatically after 1 hour

## Technical Implementation

The security system uses:

- **Cardano Serialization Lib**: For working with Cardano blockchain data
- **CIP-8/CIP-30**: For secure message signing and verification
- **Supabase**: For secure data storage with Row-Level Security
- **NextJS API Routes**: For server-side verification logic

For detailed implementation information, see [wallet_chat_security_improvements.md](./wallet_chat_security_improvements.md). 