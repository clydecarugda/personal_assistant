import ollama


from src.tools import AVAILABLE_TOOLS, TOOL_MAP
from src.llm_prompts import TOOL_SYSTEM_PROMPT


def llm_check_if_tool_is_needed(MODEL_NAME, messages: list):
    # prepend system prompt
    tool_check_messages = [
            {'role': 'system', 'content': TOOL_SYSTEM_PROMPT}
        ] + messages

    response = ollama.chat(
                model=MODEL_NAME,
                messages=tool_check_messages,
                tools=AVAILABLE_TOOLS,
                think=False,
                options={'temperature': 0.1}
            )
    

    if response.message.tool_calls:
        messages.append(response.message)
        
        for tool in response.message.tool_calls:
            tool_name = tool.function.name
            tool_args = tool.function.arguments

            # Look up and run matching Python function
            func = TOOL_MAP.get(tool_name)
            if func:
                tool_result = func(**tool_args)
            else:
                tool_result = 'Unknown Tool'

            messages.append({
                'role': 'tool',
                'tool_name': tool_name,
                'content': str(tool_result)
            })

    return messages 
