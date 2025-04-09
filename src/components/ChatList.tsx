import React from 'react';

interface Chat {
  id: string;
  name: string;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, selectedChatId, onSelectChat }) => {
  return (
    <div className="w-64 bg-gray-100 h-full overflow-y-auto p-2">
      <h3 className="text-lg font-semibold mb-4 p-2">Conversations</h3>
      <ul>
        {chats.map((chat) => (
          <li 
            key={chat.id}
            className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
              selectedChatId === chat.id ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-200'
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            {chat.name}
          </li>
        ))}
        {chats.length === 0 && (
          <li className="p-3 text-gray-500 italic">No conversations yet</li>
        )}
      </ul>
    </div>
  );
};

export default ChatList; 