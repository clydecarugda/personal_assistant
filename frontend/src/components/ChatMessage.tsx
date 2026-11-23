import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound } from 'lucide-react';
import type { Message } from '../types';

export function ChatMessage({ message, assistantName }: { message: Message; assistantName: string }) {
  const assistant = message.role === 'assistant';
  return <article className={`message-row ${assistant ? 'assistant-row' : 'user-row'}`}>
    <div className={`avatar ${assistant ? 'assistant-avatar' : 'user-avatar'}`} aria-hidden="true">{assistant ? <Bot size={16} /> : <UserRound size={15} />}</div>
    <div className="message-content"><div className="message-meta">{assistant ? assistantName : 'You'}<time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt)}</time></div>
      <div className={`message-bubble ${assistant ? 'assistant-bubble' : 'user-bubble'}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  </article>;
}
