# Stillroom — Phase 1 frontend

A responsive, local-first React + TypeScript chat interface for an offline personal assistant. It includes conversation history with deletion, Markdown responses, a streaming composer with stop control, mobile navigation, settings, a persisted dark mode toggle, and a Flask backend contract. Conversations are saved in the browser's `localStorage`; the included preview response keeps the UI usable when Flask is offline.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- Optional: Flask backend on `http://127.0.0.1:5000`

## Install and run

```bash
cd offline-assistant
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Leave `VITE_API_BASE_URL` empty to use the Vite development proxy, or set it to the Flask origin, such as `http://127.0.0.1:5000`. Restart Vite after changing `.env`. Run Flask separately on port 5000. Update its `/api/chat` route using the example below so it passes the incoming `messages` list to Ollama. The sidebar trash icon opens a custom confirmation dialog before deleting a conversation; the sidebar can be collapsed and reopened with the top-left menu button. The moon/sun button switches themes. In Settings, edit **App name** (sidebar brand) and **Assistant name** (speaker label on assistant replies). These preferences, the theme, and conversation history persist in this browser profile.

For a production bundle, run `npm run build`; `npm run preview` serves that bundle locally. The UI uses system fonts and does not need a remote font service.

## Flask API contract

The client sends a request to `POST /api/chat`:

```json
{
  "message": "Summarize my meeting notes",
  "conversation_id": "a-browser-generated-uuid",
  "messages": [
    {"role": "user", "content": "Earlier question"},
    {"role": "assistant", "content": "Earlier answer"},
    {"role": "user", "content": "Summarize my meeting notes"}
  ]
}
```

Without attachments, the frontend sends JSON. With attachments, it sends `multipart/form-data` containing `message`, `conversation_id`, a JSON string in `messages`, and one or more `files` parts. It supports up to 5 files per message, 20 MB each, with `.txt`, `.md`, `.pdf`, `.docx`, `.csv`, and `.json` extensions. Flask must parse multipart requests as shown below.

Recommended streaming response: `Content-Type: text/event-stream`. Emit newline-delimited SSE events with a blank line between each event, then `[DONE]`:

```text
data: {"token":"Here is the summary"}

data: [DONE]

```

The `messages` array contains the full non-empty conversation so far, including the current user message, and is sent on each request. Update Flask to pass `data["messages"]` into your model client; example below. The `message` field remains present for simple/legacy handlers. The frontend also accepts a normal JSON response with either `{"response":"..."}` or `{"content":"..."}`. For streamed events it reads a `token` or `content` string from each JSON data event. The stop button aborts the browser request; Flask should propagate disconnect/cancellation to the model generation where its model runtime supports it.

For the Flask handler shown in your current setup, install the document readers and replace the route with this version. It extracts text from each attachment and includes it in the current request to Ollama.

```bash
pip install pypdf python-docx
```

```python
import json
from io import BytesIO
from pathlib import Path

from docx import Document
from flask import jsonify, request
from pypdf import PdfReader

# Limit aggregate uploads to the frontend's 5 × 20 MB maximum.
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

def extract_attachment(upload):
    name = upload.filename or 'attachment'
    extension = Path(name).suffix.lower()
    raw = upload.read()

    if extension in {'.txt', '.md', '.csv', '.json'}:
        return raw.decode('utf-8', errors='replace')
    if extension == '.pdf':
        reader = PdfReader(BytesIO(raw))
        return '\n'.join(page.extract_text() or '' for page in reader.pages)
    if extension == '.docx':
        document = Document(BytesIO(raw))
        return '\n'.join(paragraph.text for paragraph in document.paragraphs)
    raise ValueError(f'Unsupported file type: {extension or "unknown"}')

@app.route('/api/chat', methods=['POST'])
def llm_chat():
    if request.mimetype == 'multipart/form-data':
        data = request.form
        uploads = request.files.getlist('files')
        raw_messages = data.get('messages', '[]')
        try:
            messages = json.loads(raw_messages)
        except json.JSONDecodeError:
            return jsonify({'status': 'error', 'message': 'Invalid messages JSON'}), 400
    else:
        data = request.get_json(silent=True) or {}
        uploads = []
        messages = data.get('messages')

    if not isinstance(messages, list) or not messages:
        user_message = data.get('message', '').strip()
        if not user_message:
            return jsonify({'status': 'error', 'message': 'Missing required field: message'}), 400
        messages = [{'role': 'user', 'content': user_message}]

    messages = [
        {'role': item['role'], 'content': item['content']}
        for item in messages
        if isinstance(item, dict)
        and item.get('role') in {'user', 'assistant'}
        and isinstance(item.get('content'), str)
        and item['content'].strip()
    ]
    if not messages or messages[-1]['role'] != 'user':
        return jsonify({'status': 'error', 'message': 'Expected a user message'}), 400

    if uploads:
        extracted = []
        remaining_chars = 60000
        try:
            for upload in uploads:
                text = extract_attachment(upload)
                text = text[:remaining_chars]
                remaining_chars -= len(text)
                extracted.append(f'### {upload.filename}\n{text}')
                if remaining_chars <= 0:
                    break
        except ValueError as error:
            return jsonify({'status': 'error', 'message': str(error)}), 415

        messages[-1]['content'] += '\n\nAttached file contents:\n' + '\n\n'.join(extracted)

    result = chat(model=MODEL_NAME, messages=messages)
    return jsonify({'response': result.message.content})
```

This example places extracted text into the current model request; it doesn’t save or index uploaded files. For persistent RAG, replace that extraction step with your document chunking, indexing, and retrieval pipeline. Image-only PDFs may need OCR.

The browser stores the history locally; the full history is sent to Flask each time the user sends a new message.

To change the code defaults instead of using Settings, change the `stillroom` and `Stillroom` fallback values in the `appName` and `assistantName` state initializers in `src/App.tsx`. The sidebar also has a final `stillroom` fallback in `src/components/Sidebar.tsx`.
The sidebar polls `GET /api/health` every 5 seconds while the page is visible and updates its model status automatically. During streamed replies, the chat follows new tokens while you are near the bottom; scrolling up pauses auto-follow until you return to the bottom. Return HTTP 200 when the API (and, ideally, local model) can accept requests, for example:

```json
{"status":"ok","model":"qwen2.5:7b","ready":true}
```

The phase-one frontend only uses the HTTP status for its connected/preview indicator. A failed request or unavailable endpoint triggers a streamed mock reply so the UI can be explored without Flask. Configure CORS for the Vite origin (`http://127.0.0.1:5173`) if Flask is hosted separately; the dev proxy avoids CORS for the default setup.

### Vite development proxy

The included `vite.config.ts` forwards `/api/*` to `http://127.0.0.1:5000` when `VITE_API_BASE_URL` is empty. Change the proxy target there if your Flask server uses another port. If `VITE_API_BASE_URL` is set, requests go directly to that origin and Flask must allow the browser's origin.

## Data and privacy notes

- Conversation text is stored in browser `localStorage` on this device and browser profile. Clearing site data removes it.
- Conversation history is stored in this browser profile. When the user sends a message, the full non-empty history and conversation ID are sent to the configured backend, which may process or log that request according to its own setup.
- The mock fallback echoes the submitted text in a preview response; it is not an LLM and does not retrieve documents.
- Dark mode preference is stored in localStorage.
- Selected attachments are sent to `/api/chat` only when the user sends the message. In preview mode, files are not uploaded or processed.

## Project structure

```text
src/
  components/   Sidebar, message renderer, composer, settings and delete dialogs
  lib/          Flask client and localStorage helpers
  App.tsx       Conversation state, streaming scroll behavior, health polling, history requests, theme, and page layout
  styles.css    Responsive visual system
  types.ts      Shared conversation/message models
```
