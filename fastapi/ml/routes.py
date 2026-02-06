from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from ml.application.agent.schemas import AgentRequest, AgentResponse
from ml.application.agent.streaming import stream_agent_response
from ml.application.agent.graph import run_agent

router = APIRouter(prefix="/ml", tags=["ML"])


@router.get("/models")
async def get_ollama_models():
    """
    Get the list of available Ollama models.
    """
    try:
        import subprocess
        import json
        
        # Use ollama CLI to list models
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Parse the output
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        models = []
        
        for line in lines:
            if line.strip():
                # Extract model name (first column)
                model_name = line.split()[0]
                models.append(model_name)
        
        return {
            "count": len(models),
            "models": models
        }
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Ollama service: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing models: {str(e)}"
        )

# class ChatRequest(BaseModel):
#     message: str
#     model: str = "gemma3:4b"

# @router.post("/chat")
# async def chat_stream(request: ChatRequest):
#     """
#     Stream chat responses from Ollama model.
#     Returns Server-Sent Events stream for live updates.
#     """
#     try:
#         def generate():
#             stream = ollama.chat(
#                 model=request.model,
#                 messages=[{"role": "user", "content": request.message}],
#                 stream=True
#             )
            
#             for chunk in stream:
#                 if chunk['message']['content']:
#                     # Send each chunk as JSON
#                     yield f"data: {json.dumps({'content': chunk['message']['content']})}\n\n"
            
#             # Send end signal
#             yield f"data: {json.dumps({'done': True})}\n\n"
        
#         return StreamingResponse(
#             generate(),
#             media_type="text/event-stream",
#             headers={
#                 "Cache-Control": "no-cache",
#                 "Connection": "keep-alive",
#             }
#         )
#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=f"Chat failed: {str(e)}"
#         )


@router.post("/agent/chat", response_class=StreamingResponse)
async def agent_chat_stream(request: AgentRequest):
    """
    Stream agent responses with tool calling capabilities.
    
    The agent can use tools like web search and article scraping to answer questions.
    Returns Server-Sent Events stream for live updates including:
    - Agent thoughts and reasoning
    - Tool calls and results
    - Final responses
    
    Example:
        POST /ml/agent/chat
        {
            "message": "Search for the latest AI news and summarize the top article",
            "model": "gemma2:2b",
            "max_iterations": 10
        }
    """
    try:
        return StreamingResponse(
            stream_agent_response(
                message=request.message,
                model=request.model,
                conversation_history=[msg.model_dump() for msg in request.conversation_history],
                max_iterations=request.max_iterations
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable proxy buffering for immediate streaming
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent chat failed: {str(e)}"
        )


@router.post("/agent/chat-sync", response_model=AgentResponse)
async def agent_chat_sync(request: AgentRequest):
    """
    Synchronous agent chat without streaming.
    
    Waits for the agent to complete all reasoning and tool calls,
    then returns the final response.
    
    Useful for:
    - Simple integrations that don't need streaming
    - Batch processing
    - Cases where you want the complete response at once
    
    Example:
        POST /ml/agent/chat-sync
        {
            "message": "What is the capital of France?",
            "model": "gemma2:2b"
        }
    """
    try:
        result = run_agent(
            message=request.message,
            model=request.model,
            conversation_history=[msg.model_dump() for msg in request.conversation_history],
            max_iterations=request.max_iterations
        )
        
        # Extract tool calls from messages
        tool_calls = []
        for msg in result.get("messages", []):
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append({
                        "name": tc.get("name"),
                        "input": tc.get("args")
                    })
        
        return AgentResponse(
            response=result["response"],
            tool_calls=tool_calls,
            iterations=result["iterations"],
            model=request.model
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent chat failed: {str(e)}"
        )
