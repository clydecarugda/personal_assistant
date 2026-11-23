from flask import Flask, request, jsonify, Response, stream_with_context
from ollama import chat, list as list_models
from dotenv import load_dotenv

import os
import json


from src.llm_helper import llm_check_if_tool_is_needed
from src.llm_prompts import MAIN_SYSTEM_PROMPT, ARTICLE_REWRITER_PROMPT


app = Flask(__name__)

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL")
MODEL_NAME = os.getenv("MODEL_NAME")


@app.route('/api/health', methods=['GET'])
def health():
    try:
        models = list_models().models

        # Ollama model entries expose their installed name in `model`.
        available_models = {
            getattr(item, 'model', None) or getattr(item, 'name', None)
            for item in models
        }

        model_ready = MODEL_NAME in available_models

        return jsonify({
            'status': 'ok' if model_ready else 'unavailable',
            'model': MODEL_NAME,
            'ready': model_ready,
            'available_models': sorted(name for name in available_models if name),
        }), 200 if model_ready else 503

    except Exception:
        app.logger.exception('Ollama health check failed')
        return jsonify({
            'status': 'unavailable',
            'model': MODEL_NAME,
            'ready': False,
        }), 503


@app.route('/api/chat', methods=['POST'])
def llm_chat():
    data = request.get_json(silent=True) or {}
    messages = data.get('messages')

    if not isinstance(messages, list) or not messages:
        user_message = data.get('message', '').strip()
        if not user_message:
            return jsonify({
                'status': 'error',
                'message': 'Missing required field: message'
            }), 400
        messages = [{'role': 'user', 'content': user_message}]

    messages = [
        {'role': item['role'], 'content': item['content']}
        for item in messages
            if isinstance(item, dict)
                and item.get('role') in {'user', 'assistant'}
                and isinstance(item.get('content'), str)
                and item['content'].strip()
    ]
    if not messages:
        return jsonify({'status': 'error', 'message': 'No valid messages supplied'}), 400

    # # Check if we need to run a tool
    # messages = llm_check_if_tool_is_needed(MODEL_NAME, messages)

    # Prepend system prompt
    messages = [
        {
            'role': 'system',
            'content': ARTICLE_REWRITER_PROMPT
        }
    ] + messages
    
    def generate():
        for chunk in chat(
                model=MODEL_NAME,
                messages=messages,
                options={
                    'temperature': 0.7,
                    'top_p': 0.9
                    },
                think=False,
                stream=True
            ):

            token = chunk.message.content or ''
            if token:
                event = json.dumps({'token': token}, ensure_ascii=False)
                yield f'data: {event}\n\n'

        yield 'data: [DONE]\n\n'

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


if __name__ == '__main__':
    app.run(debug=True)