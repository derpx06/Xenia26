"""
Efficient streaming implementation for agent responses.
"""
import json
from typing import AsyncGenerator
from loguru import logger

from .schemas import AgentStreamChunk
from .graph import stream_agent


async def stream_agent_response(
    message: str,
    model: str = "qwen2.5:7b",
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
        
        async for event in stream_agent(message, model, conversation_history, max_iterations):
            logger.debug(f"Agent event: {event.keys()}")
            
            # Process agent node events
            if "agent" in event:
                agent_output = event["agent"]
                messages = agent_output.get("messages", [])
                
                # Emit thinking indicator when agent starts processing
                if last_event_type != "agent":
                    chunk = AgentStreamChunk(
                        type="thought",
                        content="Agent is thinking..."
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"
                    last_event_type = "agent"
                
                if messages:
                    last_message = messages[-1]
                    
                    # Check for tool calls
                    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                        for tool_call in last_message.tool_calls:
                            tool_name = tool_call.get("name", "unknown")
                            tool_input = tool_call.get("args", {})
                            
                            logger.info(f"Tool call: {tool_name} with args: {tool_input}")
                            
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
                    
                    # Stream agent content incrementally
                    elif hasattr(last_message, "content") and last_message.content:
                        content = str(last_message.content)
                        
                        # Send full content if it's new or changed
                        if content and content != accumulated_content:
                            # Calculate delta
                            if content.startswith(accumulated_content):
                                new_content = content[len(accumulated_content):]
                            else:
                                new_content = content
                            
                            accumulated_content = content
                            
                            logger.debug(f"Streaming content delta: {len(new_content)} chars")
                            
                            chunk = AgentStreamChunk(
                                type="response",
                                content=new_content
                            )
                            yield f"data: {chunk.model_dump_json()}\n\n"
                
                iteration_count = agent_output.get("iterations", iteration_count)
            
            # Process tool node events
            elif "tools" in event:
                tool_output = event["tools"]
                messages = tool_output.get("messages", [])
                
                logger.info(f"Tool results received: {len(messages)} messages")
                
                if messages:
                    for msg in messages:
                        if hasattr(msg, "content"):
                            tool_name = getattr(msg, "name", "unknown")
                            
                            logger.debug(f"Tool {tool_name} completed")
                            
                            chunk = AgentStreamChunk(
                                type="tool_result",
                                content=f"✓ {tool_name} completed",
                                tool_name=tool_name,
                                tool_output=str(msg.content)[:500]
                            )
                            yield f"data: {chunk.model_dump_json()}\n\n"
                
                last_event_type = "tools"
        
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
