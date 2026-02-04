from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama
import json

router = APIRouter(prefix="/ml", tags=["ML"])

class ChatRequest(BaseModel):
    message: str
    model: str = "gemma3:4b"

@router.get("/models")
def get_ollama_models():
    """
    Get the list of available Ollama models and return the count.
    """
    try:
        models_response = ollama.list()
        model_names = [model.model for model in models_response.models]
        
        return {
            "count": len(model_names),
            "models": model_names
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Ollama service: {str(e)}"
        )

@router.post("/chat")
async def chat_stream(request: ChatRequest):
    """
    Stream chat responses from Ollama model.
    Returns Server-Sent Events stream for live updates.
    """
    try:
        def generate():
            stream = ollama.chat(
                model=request.model,
                messages=[{"role": "user", "content": request.message}],
                stream=True
            )
            
            for chunk in stream:
                if chunk['message']['content']:
                    # Send each chunk as JSON
                    yield f"data: {json.dumps({'content': chunk['message']['content']})}\n\n"
            
            # Send end signal
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {str(e)}"
        )
