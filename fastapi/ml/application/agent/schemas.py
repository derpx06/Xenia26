from typing import List, Dict, Any, Optional, Literal, TypedDict
from pydantic import BaseModel, Field


# --- 1. The Structured Data Models (The "Files") ---

# --- New: Channel Enum ---
ChannelType = Literal["email", "linkedin_post", "whatsapp", "twitter_thread", "research_report", "general_response"]

class ProspectProfile(BaseModel):
    name: str = Field(description="Full name")
    role: str = Field(description="Job title")
    company: str = Field(description="Company name")
    recent_activity: List[str] = Field(default_factory=list)
    raw_bio: str = Field(default="")
    
class PsychProfile(BaseModel):
    disc_type: Literal["D", "I", "S", "C"]
    communication_style: str
    tone_instructions: List[str]

class StrategyBrief(BaseModel):
    """The Master Plan - Now Channel Aware"""
    target_channel: ChannelType = Field(description="The format we are writing for")
    goal: str = Field(description="The objective (e.g. 'Get a meeting', 'Answer question')")
    hook: str = Field(description="The opening line/concept")
    key_points: List[str] = Field(description="Bullet points to cover")
    framework: str = Field(description="The structure (e.g. AIDA, PAS, Direct Answer)")
    cta: str = Field(description="The specific Call to Action (or 'None' for general)")

class CritiqueResult(BaseModel):
    score: int
    feedback: str
    passed: bool

class AgentState(TypedDict):
    # Inputs
    target_url: str
    user_instruction: str # CHANGED: Replaces 'user_offer' to be more generic
    
    # Internal Memory
    prospect: Optional[ProspectProfile]
    psych: Optional[PsychProfile]
    strategy: Optional[StrategyBrief]
    
    # Drafting
    drafts: List[str]
    latest_critique: Optional[CritiqueResult]
    revision_count: int
    
    # Final Output
    final_output: Optional[str]
    logs: List[str]

    
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
    message: str = Field(..., description="User's message/instruction")
    model: str = Field(default=settings.LLM_MODEL, description="Ollama model to use")
    conversation_history: List[Message] = Field(
        default_factory=list,
        description="Previous conversation messages"
    )
    max_iterations: int = Field(
        default=10,
        description="Max reasoning steps"
    )
    thread_id: Optional[str] = Field(
        default=None,
        description="Thread ID for persistence"
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
    """Final aggregated response."""
    response: str
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    iterations: int
    model: str
