from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from ml.application.agent.schemas import AgentRequest, AgentResponse
from ml.application.agent.streaming import stream_agent_response
from ml.application.agent.graph import run_agent
from ml.infrastructure.db.sqlite import get_thread_history, add_message, create_thread, get_all_threads

SARGE_AVAILABLE = True
SARGE_IMPORT_ERROR = None
try:
    from ml.application.sarge.graph import run_sarge, stream_sarge
    from ml.application.sarge.nodes import get_tts
except Exception as e:
    # Allow main app to start without optional SARGE/TTS dependencies
    SARGE_AVAILABLE = False
    SARGE_IMPORT_ERROR = str(e)
import uuid
import os
import asyncio

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
        # 1. Handle Thread ID
        thread_id = request.thread_id or str(uuid.uuid4())
        
        # 2. Get History if thread exists
        history_dicts = get_thread_history(thread_id)
        
        # If history exists, it overrides request.conversation_history
        # But for now, let's merge or use request history if DB is empty
        # A simple strategy: usage of DB history is preferred if thread_id was provided
        if request.thread_id and history_dicts:
            pass # We will use history_dicts below
        else:
            # If no existing thread, use request history
            history_dicts = [msg.model_dump() for msg in request.conversation_history]
            
        # 3. Save User Message
        add_message(
            thread_id=thread_id,
            role="user",
            content=request.message
        )

        # 4. Stream and Capture Response
        async def stream_and_persist():
            full_response = ""
            tool_calls = []
            
            # Send initial thread_id event if needed by frontend (optional)
            yield f"data: {json.dumps({'thread_id': thread_id})}\n\n"
            
            async for chunk in stream_agent_response(
                message=request.message,
                model=request.model,
                conversation_history=history_dicts,
                max_iterations=request.max_iterations
            ):
                # Parse chunk to accumulate content
                if chunk.startswith("data: "):
                    try:
                        data = json.loads(chunk[6:])
                        if "content" in data:
                            full_response += data["content"]
                        # We might parse tool calls here if needed, but simplified for now
                        # Ideally, stream_agent_response should yield structured events we can capture
                    except:
                        pass
                yield chunk
            
            # 5. Save Assistant Message on completion
            # Note: capturing tool calls from raw stream text is hard. 
            # Ideally stream_agent_response returns the final state or we refactor.
            # For now, we save the text response.
            if full_response:
                add_message(
                    thread_id=thread_id,
                    role="assistant",
                    content=full_response
                )

        return StreamingResponse(
            stream_and_persist(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
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
        # Extract target_url and user_instruction
        import re
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, request.message)
        if urls:
            target_url = urls[0]
            user_instruction = request.message.replace(target_url, "").strip() or "Analyze this"
        else:
            target_url = None
            user_instruction = request.message

        result = await run_agent(
            target_url=target_url,
            user_instruction=user_instruction
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


@router.get("/agent/threads")
async def get_threads():
    """
    Get all conversation threads.
    """
    try:
        threads = get_all_threads()
        return [
            {
                "id": t.id,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
                "metadata": {"title": t.title or "New Conversation"}
            }
            for t in threads
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch threads: {str(e)}"
        )


@router.get("/agent/threads/{thread_id}")
async def get_thread_history_endpoint(thread_id: str):
    """
    Get conversation history for a specific thread.
    """
    try:
        history = get_thread_history(thread_id)
        if not history:
            return []
            
        # Transform for frontend if necessary, or return as is
        # The frontend expects: role, content, tool_calls
        return history
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch thread history: {str(e)}"
        )

@router.post("/agent/sarge/chat", response_class=StreamingResponse)
async def sarge_chat_stream(request: AgentRequest):
    """
    Stream SARGE agent responses with granular events (microprocesses).
    
    Returns Server-Sent Events stream:
    - node_start: When a step begins (Router, Profiler, etc)
    - thought: Internal reasoning logs
    - result: Final generated content
    - token: Real-time LLM token streaming
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    session_id = request.thread_id or str(uuid.uuid4())
    
    async def event_generator():
        try:
            # Initial event to confirm connection
            yield f"data: {json.dumps({'type': 'status', 'content': 'SARGE Connected', 'session_id': session_id})}\n\n"
            
            async for chunk in stream_sarge(request.message, session_id=session_id):
                yield f"data: {chunk}\n\n"
                
            # Done signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            error_chunk = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/agent/sarge/chat-sync", response_model=AgentResponse)
async def sarge_chat_sync(request: AgentRequest):
    """
    Synchronous SARGE agent chat.
    Uses the new SARGE graph with persistence and upgrades.
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    try:
        session_id = request.thread_id or str(uuid.uuid4())
        
        result = await run_sarge(request.message, session_id=session_id)
        
        # Format response to match AgentResponse schema
        final_content = result.get("generated_content", {})
        
        # Flatten content for client if needed, or keep dict
        # The schema expects dict[str, str] for response, so we pass it directly
        
        return AgentResponse(
            response=final_content,
            tool_calls=[], # SARGE handles tools internally, doesn't expose raw calls yet
            iterations=result.get("generation_attempts", 1),
            model=request.model
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SARGE chat failed: {str(e)}"
        )
@router.post("/agent/sarge/voice")
async def sarge_voice(request: dict):
    """
    Generate audio for a given text on demand.
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    text = request.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    try:
        tts_engine = await asyncio.to_thread(get_tts)
        
        # Create static audio dir if it doesn't exist
        os.makedirs("static/audio", exist_ok=True)
        
        filename = f"manual_{uuid.uuid4().hex[:8]}.wav"
        file_path = os.path.join("static/audio", filename)
        
        # Run synthesis in thread
        await asyncio.to_thread(
            tts_engine.speak,
            text=text[:1000],
            output_path=file_path
        )
        
        return {"audio_url": f"/static/audio/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
