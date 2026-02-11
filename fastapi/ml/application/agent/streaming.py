"""
Efficient streaming implementation for agent responses.
"""
import json
import re
from typing import AsyncGenerator
from loguru import logger

from .schemas import AgentStreamChunk
from ml.settings import settings

async def stream_agent_response(
    message: str,
    model: str = settings.LLM_MODEL,
    conversation_history: list = None,
    max_iterations: int = 10
) -> AsyncGenerator[str, None]:
    """
    Stream agent responses as Server-Sent Events.
    """
    try:
        logger.info(f"Starting agent stream for message: {message[:50]}...")
        
        # We now use the simplified stream_agent from graph.py
        from .graph import stream_agent
        
        # Extract target_url and user_instruction
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, message)
        
        if urls:
            target_url = urls[0]
            user_instruction = message.replace(target_url, "").strip() or "Analyze this"
        else:
            target_url = None
            user_instruction = message
        
        iteration_count = 0
        sent_log_count = 0
        
        # Call stream_agent with new signature: (user_instruction, target_url)
        async for state_update in stream_agent(user_instruction=user_instruction, target_url=target_url):
            node_name = state_update.get("node")
            logs = state_update.get("logs", [])
            final_output = state_update.get("final_output")
            
            iteration_count += 1
            
            # Send all new logs as "thoughts"
            if logs:
                current_log_count = len(logs)
                if current_log_count > sent_log_count:
                    new_logs = logs[sent_log_count:]
                    for log_entry in new_logs:
                        # Ensure log is a string
                        log_str = str(log_entry)
                        chunk = AgentStreamChunk(
                            type="thought",
                            content=f"[{node_name.upper()}] {log_str}" if not log_str.startswith("[") else log_str
                        )
                        yield f"data: {chunk.model_dump_json()}\n\n"
                    
                    sent_log_count = current_log_count
            
            # If we have a final output, send it as the response
            if final_output:
<<<<<<< HEAD
                # --- FIX 1: UNWRAP DICTIONARY TO STRING ---
                content_to_send = final_output
                if isinstance(final_output, dict):
                    content_to_send = (
                        final_output.get("email") or 
                        final_output.get("content") or 
                        final_output.get("response") or 
                        final_output.get("general_response") or
                        str(final_output)
                    )
                else:
                    content_to_send = str(final_output)
                # ------------------------------------------

                chunk = AgentStreamChunk(
                    type="response",
                    content=content_to_send
=======
                content_str = json.dumps(final_output) if isinstance(final_output, (dict, list)) else str(final_output)
                chunk = AgentStreamChunk(
                    type="response",
                    content=content_str
>>>>>>> cc8804a081a7702c6742500b164c5aeefccd4cd0
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
                
                # Send done signal
                done_chunk = AgentStreamChunk(
                    type="done",
<<<<<<< HEAD
                    content="Done",
=======
                    content=content_str,
>>>>>>> cc8804a081a7702c6742500b164c5aeefccd4cd0
                    metadata={"iterations": iteration_count}
                )
                yield f"data: {done_chunk.model_dump_json()}\n\n"
                break

    except Exception as e:
        # --- FIX 2: SAFE LOGGING (PREVENTS CRASH) ---
        import json
        
        # Log without f-string formatting on the exception object to avoid KeyError
        logger.error("Error during agent streaming: {err}", err=str(e))
        
        error_content = str(e)
        if isinstance(e, dict):
            error_content = json.dumps(e)
        elif hasattr(e, 'message'): 
            error_content = e.message
            
        yield f"data: {json.dumps({'type': 'error', 'content': error_content})}\n\n"
        # --------------------------------------------


def format_final_response(events: list) -> dict:
    """
    Extract and format the final response from agent events.
    """
    final_response = ""
    tool_calls = []
    iterations = 0
    
    for event in events:
        if "agent" in event:
            messages = event["agent"].get("messages", [])
            if messages:
                last_message = messages[-1]
                if hasattr(last_message, "content") and last_message.content:
                    final_response = last_message.content
                
                if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                    for tc in last_message.tool_calls:
                        tool_calls.append({
                            "name": tc.get("name"),
                            "input": tc.get("args")
                        })
            
            iterations = event["agent"].get("iterations", iterations)
    
    return {
        "response": final_response,
        "tool_calls": tool_calls,
        "iterations": iterations
    }