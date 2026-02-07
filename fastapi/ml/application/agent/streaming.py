"""
Efficient streaming implementation for agent responses.
"""
import json
from typing import AsyncGenerator
from loguru import logger

from .schemas import AgentStreamChunk
from .graph import stream_agent_events


from ml.settings import settings

async def stream_agent_response(
    message: str,
    model: str = settings.LLM_MODEL,
    conversation_history: list = None,
    max_iterations: int = 10
) -> AsyncGenerator[str, None]:
    """
    Stream agent responses as Server-Sent Events.
    
    This function provides efficient streaming of agent execution,
    including thoughts, tool calls, and final responses.
    
    Args:
        message: User's message
        model: Ollama model name
        conversation_history: Previous messages
        max_iterations: Maximum iterations
        
    Yields:
        SSE-formatted JSON chunks
    """
    try:
        logger.info(f"Starting agent stream for message: {message[:50]}...")
        
        iteration_count = 0
        tool_calls_made = []
        accumulated_content = ""
        last_event_type = None
        async for event in stream_agent_events(message, model, conversation_history, max_iterations):
            event_type = event.get("event")
            
            # Handle agent node start (thinking)
            if event_type == "on_chain_start":
                name = event.get("name")
                if name == "agent":
                    iteration_count += 1
                    chunk = AgentStreamChunk(
                        type="thought",
                        content=f"Agent is thinking (iteration {iteration_count})..."
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"
            
            # Handle token streaming from LLM
            elif event_type == "on_chat_model_stream":
                data = event.get("data", {})
                chunk_content = data.get("chunk", {}).content
                
                if chunk_content:
                    accumulated_content += chunk_content
                    # Send token chunk
                    chunk = AgentStreamChunk(
                        type="response",
                        content=chunk_content
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"
            
            # Handle tool execution start
            elif event_type == "on_tool_start":
                data = event.get("data", {})
                tool_name = event.get("name")
                tool_input = data.get("input")
                
                # Filter out system tools or internal calls if any
                if tool_name and tool_name not in ["agent", "tools"]:
                    logger.info(f"Tool call detected: {tool_name}")
                    
                    tool_calls_made.append({
                        "name": tool_name,
                        "input": tool_input
                    })
                    
                    chunk = AgentStreamChunk(
                        type="tool_call",
                        content=f"Calling {tool_name}...",
                        tool_name=tool_name,
                        tool_input=tool_input
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"
            
            # Handle tool execution result
            elif event_type == "on_tool_end":
                data = event.get("data", {})
                tool_name = event.get("name")
                tool_output = data.get("output")
                
                if tool_name and tool_name not in ["agent", "tools"]:
                    logger.debug(f"Tool completed: {tool_name}")
                    
                    # Format output string safely
                    output_str = str(tool_output)
                    if len(output_str) > 500:
                        output_str = output_str[:500] + "..."
                    
                    chunk = AgentStreamChunk(
                        type="tool_result",
                        content=f"✓ {tool_name} finished",
                        tool_name=tool_name,
                        tool_output=output_str
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"

        # Send completion signal
        chunk = AgentStreamChunk(
            type="done",
            content=accumulated_content,
            metadata={
                "iterations": iteration_count,
                "tool_calls": len(tool_calls_made)
            }
        )
        yield f"data: {chunk.model_dump_json()}\n\n"
        
        logger.info(f"Agent stream completed. Iterations: {iteration_count}, Tool calls: {len(tool_calls_made)}")
        
    except Exception as e:
        logger.error(f"Error during agent streaming: {e}", exc_info=True)
        error_chunk = AgentStreamChunk(
            type="error",
            content=f"Error: {str(e)}"
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"


def format_final_response(events: list) -> dict:
    """
    Extract and format the final response from agent events.
    
    Args:
        events: List of agent events
        
    Returns:
        Formatted response dictionary
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
