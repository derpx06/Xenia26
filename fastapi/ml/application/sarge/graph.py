"""
SARGE Graph - LangGraph workflow implementation
"""
from langgraph.graph import StateGraph, END
from loguru import logger
from functools import lru_cache
from langsmith import traceable

from .schemas import AgentState
from .router import router_node
from .nodes import (
    chat_node, profiler_node, retriever_node, strategist_node, 
    writer_node, critic_node, editor_node, fallback_node, clarification_node
)


def route_decision(state: AgentState) -> str:
    """
    Routing function based on router_decision and confidence
    """
    decision = state.get("router_decision", "unknown")
    confidence = state.get("router_confidence", 0)
    
    logger.info(f"🔀 ROUTING: Decision={decision}, Confidence={confidence:.1f}")
    
    # If confidence is low, route to clarification
    if confidence < 40:
        logger.warning(f"⚠️ ROUTING: Low confidence ({confidence:.1f}), requesting clarification")
        return "clarification"
        
    return decision


def critic_decision(state: AgentState) -> str:
    """
    Decide whether to end or retry generation based on Critic feedback
    """
    feedback = state.get("critic_feedback", {})
    attempts = state.get("generation_attempts", 0)
    
    # If ready or max attempts (2) reached, end
    if feedback.get("is_ready") or attempts >= 2:
        logger.info(f"⚖️ CRITIC DECISION: END (Ready={feedback.get('is_ready')}, Attempts={attempts})")
        return "end"
    
    # Otherwise retry
    logger.info(f"⚖️ CRITIC DECISION: RETRY (Score={feedback.get('score')})")
    return "retry"


@lru_cache(maxsize=1)
def create_sarge_graph():
    """
    Build the SARGE workflow graph
    
    Flow:
    START → Router → [Chat | Generate | Refine | Fallback] → END
    
    Generation Flow:
    Profiler → Retriever → Strategist → Writer → Critic → [RETRY? Writer | END]
    """
    logger.info("🚀 SARGE: Building workflow graph...")
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("router", router_node)
    workflow.add_node("chat", chat_node)
    workflow.add_node("profiler", profiler_node)
    workflow.add_node("retriever", retriever_node)    # NEW: Memory/RAG
    workflow.add_node("strategist", strategist_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("editor", editor_node)
    workflow.add_node("fallback", fallback_node)
    workflow.add_node("clarification", clarification_node) # NEW: Low confidence
    
    # Set entry point
    workflow.set_entry_point("router")
    
    # Add conditional edges from router
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "chat": "chat",
            "generate": "profiler",
            "refine": "editor",
            "unknown": "fallback",
            "clarification": "clarification" # NEW: Low confidence route
        }
    )
    
    # Generation pipeline: Profiler → Retriever → Strategist → Writer → Critic
    workflow.add_edge("profiler", "retriever")
    workflow.add_edge("retriever", "strategist")
    workflow.add_edge("strategist", "writer")
    workflow.add_edge("writer", "critic")
    
    # NEW: Conditional loop from Critic
    workflow.add_conditional_edges(
        "critic",
        critic_decision,
        {
            "retry": "writer",
            "end": END
        }
    )
    
    # Other nodes end after execution
    workflow.add_edge("chat", END)
    workflow.add_edge("editor", END)
    workflow.add_edge("fallback", END)
    workflow.add_edge("clarification", END)
    
    logger.info("✅ SARGE: Graph compiled successfully")
    return workflow.compile()


def is_simple_query(user_input: str) -> bool:
    """
    Detect if query is simple enough for direct LLM response
    (bypasses routing overhead for ultra-low latency)
    """
    input_lower = user_input.lower().strip()
    
    # Simple conversational queries
    simple_patterns = [
        "hi", "hello", "hey", "thanks", "thank you",
        "what can you do", "help", "who are you",
        "how are you", "are you there"
    ]
    
    # Check for command keywords (these need routing)
    complex_keywords = [
        "generate", "create", "write", "draft",
        "email", "linkedin", "message",
        "http", "www.", ".com",
        "make it", "change", "refine", "shorter", "rewrite"
    ]

    # ONLY allow ultra-brief standard greetings for direct response
    # Anything else (ambiguous, multi-word, or task-oriented) MUST be routed
    if len(user_input.split()) > 2:
        return False
        
    if any(input_lower == pattern for pattern in simple_patterns):
        return True
    
    return False


@traceable(name="Run SARGE")
async def run_sarge(user_input: str) -> dict:
    """
    Main entry point for SARGE with smart routing
    
    Simple queries: Direct LLM response (ultra-fast)
    Complex queries: Full graph workflow
    """
    from .engine import get_engine
    
    # Check if query is simple enough for direct response
    if is_simple_query(user_input):
        logger.info("⚡ SARGE: Simple query detected - direct LLM response")
        
        engine = get_engine()
        
        try:
            response = engine.creative.invoke(
                f"""You are an Outreach Assistant. 
                
You DO NOT answer general questions like weather, news, or coding. If a user asks these, politely reply that you only help with cold outreach.

User question: {user_input}

Respond briefly and naturally. If they greet you, be friendly."""
            )
            
            return {
                "raw_input": user_input,
                "router_decision": "direct",
                "prospect_data": None,
                "rag_context": [],
                "generated_content": {"direct_response": response.content},
                "conversation_history": [
                    f"User: {user_input}",
                    f"Assistant: {response.content}"
                ]
            }
        except Exception as e:
            logger.error(f"⚡ SARGE: Direct response failed - {e}")
            # Fallback to graph
    
    # Complex query - use full graph
    logger.info("🔀 SARGE: Complex query - using graph workflow")
    
    graph = create_sarge_graph()
    
    initial_state = {
        "raw_input": user_input,
        "router_decision": "",
        "router_confidence": 0.0,
        "prospect_data": None,
        "strategy_brief": {},
        "retrieved_templates": [],
        "critic_feedback": {},
        "generation_attempts": 0,
        "rag_context": [],
        "generated_content": {},
        "conversation_history": []
    }
    
    result = await graph.ainvoke(initial_state)
    return result
