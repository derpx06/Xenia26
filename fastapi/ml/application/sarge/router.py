"""
SARGE Router - The Switchboard
Intent classification and traffic routing
"""
from langsmith import traceable
from loguru import logger
from .schemas import AgentState, RouterOutput
from .engine import get_engine
import instructor
import openai
from typing import List


def detect_channels(user_input: str) -> List[str]:
    """
    Detect which channels the user is requesting (email, linkedin, whatsapp)
    Returns list of requested channels, defaults to all if ambiguous
    """
    input_lower = user_input.lower()
    channels = []
    
    # Check for explicit channel mentions
    if any(word in input_lower for word in ["email", "mail", "e-mail"]):
        channels.append("email")
    if any(word in input_lower for word in ["linkedin", "linkedin dm", "linkedin message"]):
        channels.append("linkedin")
    if any(word in input_lower for word in ["whatsapp", "whats app", "sms", "text message"]):
        channels.append("whatsapp")
    
    # If no specific channel mentioned, default to EMAIL (EXTREME SPEED)
    if not channels:
        channels = ["email", "linkedin", "whatsapp"]
    
    return channels



@traceable(name="SARGE Router")
async def router_node(state: AgentState) -> AgentState:
    """
    The Switchboard - Classifies intent and routes traffic
    Preset A: Temperature 0.0, JSON output
    """
    raw_input = state["raw_input"].strip()
    logger.info(f"🔀 ROUTER: Analyzing input: '{raw_input[:50]}...'")
    
    # --- TURBO: Skip if heuristic already decided in graph.py ---
    if state.get("router_decision"):
        logger.info(f"⚡ ROUTER: Using heuristic decision: {state['router_decision']}")
        # Detect channels from input if heuristic matched
        requested_channels = detect_channels(raw_input)
        return {
            "router_decision": state["router_decision"],
            "router_confidence": state.get("router_confidence", 100.0),
            "requested_channels": requested_channels
        }
    
    # Use LLM for intent classification
    engine = get_engine()
    
    # Setup structured output with shared engine client
    llm_client = engine.structured
    
    classification_prompt = f"""
You are a routing classifier for a Cold Outreach Assistant (SARGE).

Classify the user intent into ONE of these categories:
1. "chat" - General conversation, greetings, questions about SARGE, or providing personal context (e.g., 'My name is X'). Also includes follow-up questions to previous conversation.
2. "generate" - Request to create COLD OUTREACH content (Email/LinkedIn/WhatsApp). MUST mention a specific prospect, role, company, or provide a URL/text to analyze. 
3. "refine" - Instructions to modify existing draft content (shorter, formal, rewrite).
4. "unknown" - Gibberish, random input, or totally out-of-scope topics (weather, news, coding, math, general research).

CRITICAL RULES:
- "Coding", "Writing Python script", "Math problems", "Weather" are NOT 'generate' tasks. They are "unknown".
- Even if the user says "write a script", classify as "unknown" if it's not cold outreach.
- BE CONSERVATIVE with 'generate'. If there's no clear prospect info, use 'unknown'.
- BE CRITICAL with confidence (0.0 to 1.0). For ambiguous input, use 'unknown' and score below 0.4.

User Input: "{state['raw_input']}"

Provide your classification with confidence (0-1) and brief reasoning.
"""
    
    try:
        result: RouterOutput = await llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=RouterOutput,
            messages=[
                {"role": "system", "content": "You are a precise intent classifier. Return only valid JSON."},
                {"role": "user", "content": classification_prompt}
            ],
            temperature=0.0,
            max_retries=2
        )
        
        logger.info(f"🔀 ROUTER: Decision={result.destination}, Confidence={result.confidence:.2f}")
        logger.info(f"🔀 ROUTER: Reasoning - {result.reasoning}")
        
        # NEW: Detect requested channels from user input
        requested_channels = detect_channels(raw_input)
        logger.info(f"🔀 ROUTER: Detected channels - {requested_channels}")
        
        # Return updated state - must return dict with only updated fields
        return {
            "router_decision": result.destination,
            "router_confidence": result.confidence * 100, # Convert to 0-100 scale
            "requested_channels": requested_channels  # NEW: Store detected channels
        }
        
    except Exception as e:
        logger.error(f"🔀 ROUTER: Classification failed - {e}")
        # Fallback to unknown
        return {
            "router_decision": "unknown"
        }
