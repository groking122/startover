# Wallet Chat Application

A Next.js TypeScript project that implements a chat application with wallet integration.

## Features

- **TopBar Component**: Contains buttons for connecting to Eternl Wallet, refreshing conversations, and creating new conversations.
- **ChatList Component**: Displays a list of available chats that can be selected.
- **ChatContainer Component**: Shows the messages for the selected chat in a chat bubble interface.
- **InputArea Component**: Provides a text input and send button for messaging.
- **Wallet Integration**: Simple demonstration of wallet connection state (connect/disconnect button).

## Technology Stack

- Next.js 15.2.4
- React 19
- TypeScript
- Tailwind CSS 3

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone [repository URL]
cd [repository name]
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

```
src/
├── app/
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout component
│   └── page.tsx          # Main page component
├── components/
│   ├── TopBar.tsx        # Navigation and action buttons
│   ├── ChatList.tsx      # List of chat conversations
│   ├── ChatContainer.tsx # Displays chat messages
│   └── InputArea.tsx     # Message input and send button
└── types/
    └── index.ts          # TypeScript type definitions
```

## Features to Add

- **Real Wallet Integration**: Connect to actual blockchain wallets like Eternl
- **User Authentication**: Add user login/registration
- **Persistent Storage**: Save conversations to a database
- **Real-time Chat**: Implement WebSockets for real-time messaging
- **Encryption**: Add end-to-end encryption for messages

## License

[MIT License](LICENSE)
