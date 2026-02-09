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


@traceable(name="SARGE Router")
def router_node(state: AgentState) -> AgentState:
    """
    The Switchboard - Classifies intent and routes traffic
    Preset A: Temperature 0.0, JSON output
    """
    raw_input = state["raw_input"].strip()
    logger.info(f"🔀 ROUTER: Analyzing input: '{raw_input[:50]}...'")
    
    # Use LLM for intent classification
    engine = get_engine()
    
    # Setup structured output with instructor
    llm_client = instructor.from_openai(
        openai.OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        ),
        mode=instructor.Mode.JSON
    )
    
    classification_prompt = f"""
You are a routing classifier for a Cold Outreach Assistant (SARGE).

Classify the user intent into ONE of these categories:
1. "chat" - Greetings, casual questions about SARGE's purpose, or high-level outreach strategy advice.
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
        result: RouterOutput = llm_client.chat.completions.create(
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
        
        # Return updated state - must return dict with only updated fields
        return {
            "router_decision": result.destination,
            "router_confidence": result.confidence * 100 # Convert to 0-100 scale
        }
        
    except Exception as e:
        logger.error(f"🔀 ROUTER: Classification failed - {e}")
        # Fallback to unknown
        return {
            "router_decision": "unknown"
        }
