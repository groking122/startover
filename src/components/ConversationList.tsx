import React from 'react';
import { Chat } from '../types';

interface ConversationListProps {
  conversations: Chat[];
  onSelectConversation: (id: string) => void;
  selectedConversationId: string | null;
  isLoading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onSelectConversation,
  selectedConversationId,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="w-64 bg-gray-50 h-full p-3 overflow-y-auto border-r border-gray-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conversations</h2>
        </div>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 h-full p-3 overflow-y-auto border-r border-gray-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
      </div>
      
      {conversations.length > 0 ? (
        <ul className="space-y-2">
          {conversations.map(convo => (
            <li 
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={`
                p-3 rounded-md cursor-pointer
                ${selectedConversationId === convo.id 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-gray-100'
                }
              `}
            >
              <div className="font-medium">{convo.name}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500 text-sm px-3 py-2">
          No conversations yet. Connect your wallet and create a new conversation.
        </div>
      )}
    </div>
  );
};

export default ConversationList; 