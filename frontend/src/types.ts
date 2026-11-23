export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};
