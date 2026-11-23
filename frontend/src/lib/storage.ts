import type { Conversation } from '../types';

const KEY = 'stillroom.conversations.v1';

export function loadConversations(): Conversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Conversation =>
      item && typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages),
    );
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(conversations));
  } catch {
    // The chat remains usable in memory if browser storage is unavailable or full.
  }
}
