export type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string };
export type ChatRequest = { message: string; conversation_id: string; messages: ChatHistoryMessage[] };
export type ChatResult = { content: string; source: 'backend' | 'mock' };

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Expected Flask contract:
 * POST /api/chat { message, conversation_id, messages }
 * Either JSON { response: string } / { content: string }, or an SSE stream
 * with `data: {"token":"..."}` events and a final [DONE].
 */
export async function sendChat(
  payload: ChatRequest,
  signal: AbortSignal,
  onToken: (token: string) => void,
  attachments: File[] = [],
): Promise<ChatResult> {
  try {
    const headers: Record<string, string> = { Accept: 'text/event-stream, application/json' };
    let body: BodyInit;
    if (attachments.length) {
      const formData = new FormData();
      formData.append('message', payload.message);
      formData.append('conversation_id', payload.conversation_id);
      formData.append('messages', JSON.stringify(payload.messages));
      attachments.forEach((file) => formData.append('files', file, file.name));
      body = formData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body,
      signal,
    });
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      if (!response.body) throw new Error('Streaming response has no body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          const data = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
          if (!data || data === '[DONE]') continue;
          const parsed: unknown = JSON.parse(data);
          const token = typeof parsed === 'object' && parsed !== null && 'token' in parsed && typeof parsed.token === 'string'
            ? parsed.token
            : typeof parsed === 'object' && parsed !== null && 'content' in parsed && typeof parsed.content === 'string'
              ? parsed.content : '';
          if (token) { content += token; onToken(token); }
        }
        if (done) break;
      }
      return { content, source: 'backend' };
    }

    const data: unknown = await response.json();
    const content = typeof data === 'object' && data !== null && 'response' in data && typeof data.response === 'string'
      ? data.response
      : typeof data === 'object' && data !== null && 'content' in data && typeof data.content === 'string'
        ? data.content : '';
    if (!content) throw new Error('Backend returned no response text');
    onToken(content);
    return { content, source: 'backend' };
  } catch (error) {
    if (signal.aborted) throw error;
    // The mock keeps the UI demonstrable without a Flask process.
    const content = mockReply(payload.message, attachments.map((file) => file.name));
    for (const part of content.match(/.{1,20}(?:\s|$)/g) ?? [content]) {
      await new Promise((resolve) => window.setTimeout(resolve, 24));
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
      onToken(part);
    }
    return { content, source: 'mock' };
  }
}

function mockReply(prompt: string, fileNames: string[]) {
  const fileNote = fileNames.length
    ? `\n\nThe preview did not process these attachments: ${fileNames.join(', ')}.`
    : '';
  return `I’m running in **local preview mode** because the Flask backend isn’t available.\n\nWhen connected, I can search your indexed notes and answer with context. You said:\n\n> ${prompt.replace(/\n/g, '\n> ')}${fileNote}\n\nStart the backend and try again to use your local model.`;
}

export async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch { return false; }
}
