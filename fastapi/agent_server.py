
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ml.application.agent.streaming import stream_agent_response
from loguru import logger

app = FastAPI(title="Agent Testing Server")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    message: str
    model: str = "qwen2.5:7b"
    max_iterations: int = 10
    conversation_history: list = None

@app.post("/agent/stream")
async def stream_agent(request: AgentRequest):
    """
    Stream agent response directly.
    """
    logger.info(f"Received stream request: {request.message}")
    
    return StreamingResponse(
        stream_agent_response(
            message=request.message, 
            model=request.model,
            conversation_history=request.conversation_history,
            max_iterations=request.max_iterations
        ),
        media_type="text/event-stream"
    )

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("agent_server:app", host="0.0.0.0", port=8001, reload=True)
