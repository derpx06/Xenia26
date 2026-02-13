from typing import List, Dict, Any, Optional, Literal, TypedDict
from pydantic import BaseModel, Field


# --- 1. The Structured Data Models (The "Files") ---

# --- New: Channel Enum ---
ChannelType = Literal["email", "linkedin_post", "whatsapp", "twitter_thread", "research_report", "general_response", "linkedin_dm", "instagram_dm", "sms"]

class ProspectProfile(BaseModel):
    name: str = Field(description="Full name")
    role: str = Field(description="Job title")
    company: str = Field(description="Company name")
    recent_activity: List[str] = Field(default_factory=list)
    raw_bio: str = Field(default="")
    
    # New fields for better context
    industry: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None)
    seniority: Optional[str] = Field(default=None)
    interests: List[str] = Field(default_factory=list)
    primary_language: Optional[str] = Field(default=None)
    summary: Optional[str] = Field(default=None)
    source_urls: List[str] = Field(default_factory=list)
    is_placeholder: bool = Field(default=False)
    
class PsychProfile(BaseModel):
    disc_type: Literal["D", "I", "S", "C"]
    communication_style: str
    tone_instructions: List[str]
    # New: Captured style rules from writing_style_inferrer
    style_rules: List[str] = Field(default_factory=list)
    
    # New: Detailed style signals for mirroring
    avg_sentence_len: Optional[int] = None
    emoji_usage: Optional[str] = None 
    vocabulary_complexity: Optional[str] = None

class StrategyBrief(BaseModel):
    """The Master Plan - Now Channel Aware"""
    # Changed: Support multiple channels in one go, or a primary channel
    target_channels: List[ChannelType] = Field(default=["email"], description="List of channels to generate for")
    target_channel: ChannelType = Field(default="email", description="Primary channel (deprecated but kept for compat)")
    goal: str = Field(description="The objective (e.g. 'Get a meeting', 'Answer question')")
    hook: str = Field(description="The opening line/concept")
    key_points: List[str] = Field(description="Bullet points to cover")
    framework: str = Field(description="The structure (e.g. AIDA, PAS, Direct Answer)")
    cta: str = Field(description="The specific Call to Action (or 'None' for general)")

class CritiqueResult(BaseModel):
    score: int
    feedback: str
    passed: bool


class MentionTargetProfile(BaseModel):
    name: str = ""
    role: str = ""
    company: str = ""
    industry: str = ""
    seniority: str = ""
    tone: str = "professional"
    language_style: str = "clear"
    interests: List[str] = Field(default_factory=list)
    psych_traits: List[str] = Field(default_factory=list)
    recent_focus_summary: str = ""


class MentionSenderProfile(BaseModel):
    name: str = ""
    role: str = ""
    company: str = ""
    credibility_points: List[str] = Field(default_factory=list)
    value_proposition: str = ""
    tone_preference: str = "professional"


class MentionTaskIntent(BaseModel):
    intent_type: str = "outreach"
    topic_lock: str = ""
    channel_hint: str = "email"


class ContextInjection(BaseModel):
    target_profile: MentionTargetProfile = Field(default_factory=MentionTargetProfile)
    sender_profile: MentionSenderProfile = Field(default_factory=MentionSenderProfile)
    task_intent: MentionTaskIntent = Field(default_factory=MentionTaskIntent)
    mention_tokens: List[str] = Field(default_factory=list)
    compressed_memory: str = ""
    extraction_ms: int = 0


class AgentState(BaseModel):
    # Inputs
    target_url: Optional[str] = None
    user_instruction: str # CHANGED: Replaces 'user_offer' to be more generic
    user_email: Optional[str] = None
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list) # List of messages
    
    # Internal Memory
    prospect: Optional[ProspectProfile] = None
    psych: Optional[PsychProfile] = None
    strategy: Optional[StrategyBrief] = None
    
    # Drafting
    drafts: Dict[str, str] = Field(default_factory=dict) # Keyed by channel
    last_generated_channels: List[str] = Field(default_factory=list)
    latest_critique: Optional[CritiqueResult] = None
    channel_critiques: Dict[str, CritiqueResult] = Field(default_factory=dict) # NEW: Per-channel critiques
    revision_count: int = 0
    
    # Hive Mind Routing
    next_step: Optional[Literal["hunter", "profiler", "strategist", "scribe", "critic", "end"]] = None
    
    # Intent Router (NEW)
    intent_category: Optional[str] = None  # small_talk | system_question | outreach_task | research_outreach_task
    topic_lock: Optional[str] = None       # Extracted primary topic (1 sentence)
    search_keywords: List[str] = Field(default_factory=list)  # Domain-only keywords for search
    needs_search: bool = True              # Whether search was determined necessary
    direct_response: Optional[str] = None  # For small_talk/system_question bypass
    context: Optional[ContextInjection] = None

    # Final Output
    final_output: Optional[Dict[str, str]] = None # Keyed by channel
    logs: List[str] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    
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
    user_email: Optional[str] = Field(
        default=None,
        description="Authenticated sender email for @mention context lookup"
    )
    sender_name: Optional[str] = Field(
        default=None,
        description="Authenticated sender display name for personalization fallback"
    )
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
    type: Literal["thought", "tool_call", "tool_result", "response", "error", "done", "phase"]
    content: str = ""
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    """Final aggregated response for the API."""
    response: Any = Field(..., description="Final text or structured output")
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list, description="Tools used during execution")
    iterations: int = Field(0, description="Number of graph steps taken")
    model: str = Field(..., description="Model used")
