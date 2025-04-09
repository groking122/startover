# Wallet-Chat Application Architecture Schema

## 1. Overall Architecture

```mermaid
graph TD
    Client[Client Browser] --> |React Components| Frontend[Frontend Layer]
    Frontend --> |API Calls| Backend[Backend Layer]
    Backend --> |Database Queries| DB[(Supabase Database)]
    
    Client --> |Wallet Connection| WalletAPI[Cardano Wallet API]
    WalletAPI --> |Signature| Frontend
    
    subgraph "Frontend Layer"
        Components[React Components]
        Contexts[React Contexts]
        Providers[React Providers]
        Utils[Frontend Utilities]
    end
    
    subgraph "Backend Layer"
        APIRoutes[Next.js API Routes]
        Middleware[Request Middleware]
        ServerUtils[Server Utilities]
    end
    
    subgraph "Database"
        Users[Users Table]
        Messages[Messages Table]
        RateLimits[Rate Limits Table]
    end
```

## 2. Component Relationships

```mermaid
graph TD
    App[App Root] --> HomeClient
    HomeClient --> TopBar
    HomeClient --> VerifyWalletBanner
    HomeClient --> Inbox
    HomeClient --> ChatContainer
    
    Inbox --> ConversationList
    Inbox --> EmptyState
    
    ChatContainer --> ChatMessage
    ChatContainer --> ChatInput
    ChatMessage --> MessageBubble
    
    subgraph "Providers & Contexts"
        WalletIdentityProvider --> WalletIdentityContext
        ClientOnlyWalletProviders
    end
    
    HomeClient --> |uses| WalletIdentityContext
    VerifyWalletBanner --> |uses| WalletIdentityContext
    TopBar --> |uses| WalletIdentityContext
    ChatContainer --> |uses| WalletIdentityContext
```

## 3. Authentication & Verification Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant WalletExt as Wallet Extension
    participant Frontend
    participant Backend
    participant Database
    
    User->>Browser: Access application
    Browser->>Frontend: Load application
    Frontend->>WalletExt: Request wallet connection
    WalletExt-->>User: Prompt for connection approval
    User->>WalletExt: Approve connection
    WalletExt-->>Frontend: Return public address
    
    Note over Frontend: Store public address in WalletIdentityContext
    
    Frontend->>Browser: Display verification banner
    User->>Browser: Click "Verify Wallet Now"
    Frontend->>WalletExt: Request message signing
    
    Note over Frontend: Create message with timestamp and public address
    
    WalletExt-->>User: Prompt to sign message
    User->>WalletExt: Approve signing
    WalletExt-->>Frontend: Return signature and public key
    
    Frontend->>Backend: POST /api/user/verify with message, signature, pubKey
    Backend->>Backend: Verify signature using CIP-8 COSE or legacy method
    Backend->>Database: Update user record with verification timestamp
    Backend-->>Frontend: Return verification success
    
    Frontend->>Frontend: Create encrypted session in localStorage
    Frontend->>Frontend: Update UI to show verified state
    
    Note over Frontend,Backend: Subsequent API calls include session token
```

## 4. Database Schema

```mermaid
erDiagram
    USERS {
        uuid id PK
        text stake_address
        text public_address
        text public_key
        timestamp last_verified
        timestamp created_at
    }
    
    MESSAGES {
        uuid id PK
        text from_address FK
        text to_address FK
        text from_public_address FK
        text to_public_address FK
        text message
        boolean is_read
        timestamp created_at
        text signature
        text public_key
    }
    
    RATE_LIMITS {
        uuid id PK
        text key
        int count
        timestamp reset_at
        timestamp created_at
    }
    
    USERS ||--o{ MESSAGES : "sends/receives"
    USERS ||--o{ RATE_LIMITS : "is limited by"
```

## 5. Session Management & Security

```mermaid
graph TD
    subgraph "Client-Side Session Management"
        SessionCreation[Create Session] --> |Encrypt| EncryptedStorage[Encrypted localStorage]
        EncryptedStorage --> |Decrypt| SessionRetrieval[Retrieve Session]
        SessionRetrieval --> |Validate| SessionValidation[Validate Session]
        SessionValidation --> |Expired| SessionClearing[Clear Session]
    end
    
    subgraph "Server-Side Session Validation"
        APIRequest[API Request] --> |Extract Token| TokenExtraction[Extract Session Token]
        TokenExtraction --> |Decode| TokenDecoding[Decode Token]
        TokenDecoding --> |Validate| ServerValidation[Validate Token]
        ServerValidation --> |Check DB| DatabaseCheck[Check User Verification]
        DatabaseCheck --> |Add Headers| HeaderAddition[Add Address Headers]
    end
    
    SessionCreation --> |Generate Token| APIRequest
```

## 6. Migration from Stake to Public Addresses

```mermaid
graph TD
    subgraph "Database Migration"
        AddColumns[Add Public Address Columns] --> UpdateIndexes[Update Indexes]
        UpdateIndexes --> UpdatePolicies[Update RLS Policies]
        UpdatePolicies --> MigrationFunction[Create Migration Function]
        MigrationFunction --> ExecuteMigration[Execute Migration]
    end
    
    subgraph "Code Changes"
        UpdateContext[Update WalletIdentityContext] --> UpdateComponents[Update UI Components]
        UpdateComponents --> UpdateAPIs[Update API Routes]
        UpdateAPIs --> UpdateMiddleware[Update Middleware]
    end
    
    subgraph "Verification Process Changes"
        OldVerification[Stake Address Verification] --> NewVerification[Public Address Verification]
        NewVerification --> DualSupport[Support Both Address Types]
        DualSupport --> PrioritizePublic[Prioritize Public Addresses]
    end
```

## 7. Message Flow

```mermaid
sequenceDiagram
    participant Sender
    participant SenderFrontend
    participant Backend
    participant RecipientFrontend
    participant Recipient
    
    Sender->>SenderFrontend: Compose message
    SenderFrontend->>Backend: POST /api/message with recipient & content
    Backend->>Backend: Validate sender session
    Backend->>Backend: Check rate limits
    Backend->>Backend: Create recipient if not exists
    Backend->>Backend: Store message in database
    Backend-->>SenderFrontend: Return success
    
    Recipient->>RecipientFrontend: Open inbox
    RecipientFrontend->>Backend: GET /api/message
    Backend->>Backend: Validate recipient session
    Backend->>Backend: Retrieve messages for recipient
    Backend-->>RecipientFrontend: Return messages
    RecipientFrontend->>Recipient: Display messages
    
    RecipientFrontend->>Backend: Mark messages as read
    Backend->>Backend: Update is_read status
```

## 8. Verification Process Issues

The main issue with the verification process appears to be a mismatch between the updated WalletIdentityContext (which uses `publicAddress`) and the components that still reference `stakeAddress`. This is likely due to the migration from stake addresses to public addresses.

### Key Issues:

1. **Component-Context Mismatch**: 
   - The VerifyWalletBanner component checks for `stakeAddress` but the context now provides `publicAddress`
   - The HomeClient component also uses `stakeAddress` from the context

2. **Verification Button Not Appearing**:
   - Due to the mismatch, the condition `if (!stakeAddress || isVerified)` in VerifyWalletBanner is likely evaluating to true (since `stakeAddress` is undefined), causing the banner not to render

3. **Migration Challenges**:
   - The application is in a transitional state between stake address and public address authentication
   - Some components haven't been fully updated to use the new public address system

### Verification Process (Theoretical Correct Flow):

1. User connects wallet through Cardano wallet API
2. Application retrieves public address from wallet
3. VerifyWalletBanner displays when public address is available but not verified
4. User clicks "Verify Wallet Now" button
5. Application requests wallet to sign a message containing the public address
6. Signed message is sent to backend for verification
7. Backend verifies signature using either CIP-8 COSE or legacy method
8. On successful verification, user record is updated and session is created
9. UI updates to show verified state

## 9. Security Considerations

1. **Client-Side Security**:
   - Sessions are encrypted using AES-GCM before storing in localStorage
   - Device fingerprinting is used to derive encryption keys
   - Sessions expire after 1 hour

2. **Server-Side Security**:
   - Rate limiting prevents brute force attacks
   - Row-Level Security (RLS) in database ensures users can only access their own data
   - Signature verification ensures message authenticity

3. **Address Security**:
   - Migration from stake to public addresses improves security by:
     - Preventing impersonation (stake addresses are publicly visible)
     - Providing unique identification per wallet
     - Requiring proof of ownership through signature verification