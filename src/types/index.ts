export interface Chat {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'peer';
  timestamp: Date;
} 