from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class Message(BaseModel):
    """Single message in conversation history."""
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None
    id: Optional[str] = None


from ml.settings import settings


class AgentRequest(BaseModel):
    """Request schema for agent chat endpoint."""
    message: str = Field(..., description="User's message to the agent")
    model: str = Field(default=settings.LLM_MODEL, description="Ollama model to use")
    conversation_history: List[Message] = Field(
        default_factory=list,
        description="Previous conversation messages for context"
    )
    max_iterations: int = Field(
        default=10,
        description="Maximum number of agent iterations to prevent infinite loops"
    )


class AgentStreamChunk(BaseModel):
    """Streaming chunk from agent."""
    type: Literal["thought", "tool_call", "tool_result", "response", "error", "done"]
    content: str = ""
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None


class AgentResponse(BaseModel):
    """Final aggregated response from agent."""
    response: str
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    iterations: int
    model: str
