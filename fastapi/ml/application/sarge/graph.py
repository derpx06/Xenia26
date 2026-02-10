"""
SARGE Graph - LangGraph workflow implementation
"""
from langgraph.graph import StateGraph, END
from loguru import logger
from functools import lru_cache
import random
import json
from langsmith import traceable

from .schemas import AgentState
from .router import router_node
from .nodes import (
    chat_node, profiler_node, retriever_node, 
    writer_node, critic_node, editor_node, fallback_node, clarification_node,
    style_inferrer_node, voice_node
)
from .engine import get_engine
from .memory import SargeMemory


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
    workflow.add_node("writer", writer_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("editor", editor_node)
    workflow.add_node("clarification", clarification_node) # NEW: Low confidence
    workflow.add_node("style_inferrer", style_inferrer_node) # NEW: Phase 3 Style Transfer
    workflow.add_node("voice", voice_node) # NEW: TTS Audio Generation
    
    # Set entry point
    workflow.set_entry_point("router")
    
    # Add conditional edges from router
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "chat": "chat",
            "generate": "style_inferrer", # Route through style inference first
            "refine": "style_inferrer",    # Route through style inference first
            "unknown": "fallback",
            "clarification": "clarification" # NEW: Low confidence route
        }
    )
    
    # Style Inferrer decides where to go next
    def after_style_decision(state: AgentState) -> str:
        decision = state.get("router_decision")
        if decision == "refine":
            return "editor"
        return "profiler"

    workflow.add_conditional_edges(
        "style_inferrer",
        after_style_decision,
        {
            "profiler": "profiler",
            "editor": "editor"
        }
    )

    # Generation pipeline: Profiler → Retriever → Writer (Strategist merged) → Critic
    workflow.add_edge("profiler", "retriever")
    workflow.add_edge("retriever", "writer")
    workflow.add_edge("writer", "critic")
    
    # NEW: Conditional loop from Critic
    workflow.add_conditional_edges(
        "critic",
        critic_decision,
        {
            "retry": "writer",
            "end": "voice"
        }
    )
    
    workflow.add_edge("voice", END)
    
    # Other nodes end after execution
    workflow.add_edge("chat", "voice")
    workflow.add_edge("editor", "voice")
    workflow.add_edge("fallback", END)
    workflow.add_edge("clarification", END)
    
    logger.info("✅ SARGE: Graph compiled successfully")
    return workflow.compile()


@traceable(name="Evaluate Intent")
async def is_simple_chat_intent(user_input: str) -> bool:
    """
    Use a very lightweight LLM call to check if message is just conversational 
    or a task that needs SARGE processing.
    """
    input_lower = user_input.lower().strip()
    
    # 1. FORCE [TASK] for known task keywords or URLs
    task_keywords = ["email", "write", "draft", "linkedin", "message", "whatsapp", "research", "find", "who is", "search", "http"]
    if any(word in input_lower for word in task_keywords):
        return False
        
    # 2. Immediate Heuristic Bypass for basic greetings
    simple_patterns = ["hi", "hello", "hey", "thanks", "thank you", "help", "who are you"]
    if any(input_lower == p for p in simple_patterns) or len(input_lower.split()) <= 2:
        return True

    # 3. Lightweight LLM Check for borderline cases
    engine = get_engine()
    prompt = f"""Decide if this user message is a simple GREETING/QUESTION or a TASK (writing emails, researching, generating content).
User: "{user_input}"
Respond ONLY with [CHAT] or [TASK]."""
    
    try:
        response = await engine.creative.ainvoke(prompt)
        decision = response.content.upper()
        return "[CHAT]" in decision
    except:
        return False


@traceable(name="Run SARGE")
async def run_sarge(user_input: str, session_id: str = None) -> dict:
    """
    Main entry point for SARGE with smart routing
    
    Simple queries: Direct LLM response (ultra-fast)
    Complex queries: Full graph workflow
    """
    
    memory = SargeMemory() if session_id else None
    history = []
    
    if memory:
        history = memory.get_history(session_id, limit=10)
    
    # --- TURBO: Heuristic Intent Detection (FASTEST BYPASS) ---
    heuristic_keywords = ["draft", "write", "generate", "create", "email", "linkedin", "message", "prospect", "analyze"]
    if any(word in user_input.lower() for word in heuristic_keywords):
        logger.info("⚡ SARGE: Heuristic HIT - Forcing 'generate' intent (Bypassing Intent LLM)")
        router_decision = "generate"
        router_confidence = 100.0
    else:
        # Check if query is simple enough for direct response
        if await is_simple_chat_intent(user_input):
            logger.info("⚡ SARGE: Simple query detected - direct LLM response")
            
            engine = get_engine()
            
            try:
                # Add context from memory for simple queries to be smarter
                context_str = ""
                if history:
                    context_str = "Context:\n" + "\n".join([f"{m['role']}: {m['content']}" for m in history[-3:]])
                
                response = await engine.creative.ainvoke(
                    f"""You are an Outreach Assistant. 
                    
    You DO NOT answer general questions like weather, news, or coding. If a user asks these, politely reply that you only help with cold outreach.
    
    {context_str}
    
    User question: {user_input}
    
    Respond briefly and naturally. If they greet you, be friendly."""
                )
                
                # Save turn if session exists
                if memory:
                    memory.save_turn(session_id, user_input, response.content)
                
                return {
                    "raw_input": user_input,
                    "router_decision": "direct",
                    "prospect_data": None,
                    "rag_context": [],
                    "generated_content": {"chat_response": response.content},
                    "conversation_history": history + [
                        {"role": "user", "content": user_input},
                        {"role": "assistant", "content": response.content}
                    ]
                }
            except Exception as e:
                logger.error(f"⚡ SARGE: Direct response failed - {e}")
                # Fallback to graph
        
        router_decision = ""
        router_confidence = 0.0

    # Complex query - use full graph
    logger.info("🔀 SARGE: Complex query - using graph workflow")
    
    graph = create_sarge_graph()
    
    initial_state = {
        "raw_input": user_input,
        "router_decision": router_decision,
        "router_confidence": router_confidence,
        "prospect_data": None,
        "strategy_brief": {},
        "retrieved_templates": [],
        "critic_feedback": {},
        "generation_attempts": 0,
        "rag_context": [],
        "requested_channels": [],  # NEW: Initialize as empty, router will populate
        "generated_content": {},
        "conversation_history": history
    }
    
    result = await graph.ainvoke(initial_state)
    
    # Extract final response for memory
    final_content = ""
    gen_content = result.get("generated_content", {})
    
    # Try to find the best representation of the answer
    if "chat_response" in gen_content:
        final_content = gen_content["chat_response"]
    elif any(k in gen_content for k in ["email", "linkedin", "whatsapp"]):
        parts = []
        if gen_content.get("email"): parts.append(f"[Email]\n{gen_content['email']}")
        if gen_content.get("linkedin"): parts.append(f"[LinkedIn]\n{gen_content['linkedin']}")
        if gen_content.get("whatsapp"): parts.append(f"[WhatsApp]\n{gen_content['whatsapp']}")
        final_content = "\n\n".join(parts)
    elif "fallback_message" in gen_content:
        final_content = gen_content["fallback_message"]
    elif "clarification_message" in gen_content:
        final_content = gen_content["clarification_message"]
    elif "edited_content" in gen_content:
        final_content = gen_content["edited_content"]
        
    # Save to memory if we have content
    if memory and final_content:
        memory.save_turn(session_id, user_input, final_content)
        
    return result


async def stream_sarge(user_input: str, session_id: str = None):
    """
    Stream SARGE execution with granular events (microprocesses)
    Yields JSON strings for SSE
    """
    
    memory = SargeMemory() if session_id else None
    history = []
    
    if memory:
        history = memory.get_history(session_id, limit=10)
    
    # --- TURBO: Heuristic Intent Detection (FASTEST BYPASS) ---
    heuristic_keywords = ["draft", "write", "generate", "create", "email", "linkedin", "message", "prospect", "analyze"]
    if any(word in user_input.lower() for word in heuristic_keywords):
        logger.info("⚡ SARGE: Heuristic HIT (Stream) - Forcing 'generate' intent (Bypassing Intent LLM)")
        router_decision = "generate"
        router_confidence = 100.0
    else:
        # Check for simple query first
        if await is_simple_chat_intent(user_input):
            logger.info("⚡ SARGE: Simple stream query detected (LLM-detected)")
            
            # IMMEDIATELY yield node_start for UI
            yield json.dumps({
                "type": "node_start",
                "node": "CHAT",
                "content": "Conversational reply..."
            })
            
            # Add context for simple query
            context_str = ""
            if history:
                context_str = "Context:\n" + "\n".join([f"{m['role']}: {m['content']}" for m in history[-3:]])
                
            prompt = f"""You are an Outreach Assistant. 
    Respond briefly and naturally.
    
    {context_str}
    
    User: {user_input}"""

            engine = get_engine()
            full_response = ""
            
            async for chunk in engine.creative.astream(prompt):
                content = chunk.content
                if content:
                    full_response += content
                    yield json.dumps({
                        "type": "token",
                        "content": content
                    })
            
            # Save turn
            if memory and full_response:
                memory.save_turn(session_id, user_input, full_response)
                
            yield json.dumps({
                "type": "done"
            })
            return
        
        router_decision = ""
        router_confidence = 0.0

    # Complex query - stream graph events
    logger.info("🔀 SARGE: Streaming complex query")
    graph = create_sarge_graph()
    
    initial_state = {
        "raw_input": user_input,
        "router_decision": router_decision,
        "router_confidence": router_confidence,
        "conversation_history": history
        # Other state fields will be initialized by nodes or defaults
    }
    
    # IMMEDIATELY yield node_start to show the processing box
    yield json.dumps({
        "type": "node_start",
        "node": "SARGE",
        "content": "Analyzing request & initializing engine..."
    })
    
    # Use astream_events for granular updates
    async for event in graph.astream_events(initial_state, version="v2"):
        kind = event["event"]
        
        # 1. Node Transitions (Process Steps)
        # Using version v2 names: on_chain_start -> on_chain_start
        # Metadata 'langgraph_node' is the reliable way to identify which step is running
        node_name = event.get("metadata", {}).get("langgraph_node")
        
        if kind == "on_chain_start" and node_name in ["router", "profiler", "retriever", "writer", "critic", "style_inferrer", "voice"]:
            yield json.dumps({
                "type": "node_start",
                "node": node_name.upper(),
                "content": f"Entering {node_name.upper()}..."
            })
            
        # 2. Step Outputs (Thoughts/Logs)
        elif kind == "on_chain_end" and node_name in ["router", "profiler", "retriever", "writer", "critic", "style_inferrer", "voice"]:
            output = event["data"].get("output")
            if output and isinstance(output, dict):
                # Filter out heavy content, keep reasoning/status
                display_output = {k:v for k,v in output.items() if k not in ["generated_content", "raw_input", "conversation_history", "prospect_data", "writing_style"]}
                if display_output:
                    yield json.dumps({
                        "type": "thought",
                        "node": node_name.upper(),
                        "content": display_output
                    })

        # 3. Final Content Result (Yield on Writer for immediate display, then on Voice for audio)
        elif kind == "on_chain_end" and node_name in ["writer", "voice", "chat"]:
            output = event["data"].get("output", {})
            if isinstance(output, dict):
                content = output.get("generated_content", {})
                if content:
                    yield json.dumps({
                        "type": "result",
                        "content": content,
                        "metadata": {
                            "attempts": output.get("generation_attempts", 1),
                            "channels": list(content.keys())
                        }
                    })
        
        # 4. LLM Token Streaming
        elif kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            if chunk:
                # Detect channel from tags
                tags = event.get("tags", [])
                channel = next((t.split(":")[1] for t in tags if t.startswith("channel:")), None)
                
                # Send as token for chat bubble/cards
                yield json.dumps({
                    "type": "token",
                    "channel": channel,
                    "content": chunk
                })
                # Send to logs for "all streams" transparency
                # We use a special node name 'STREAM' for live tokens
                yield json.dumps({
                    "type": "thought",
                    "node": "GENERATOR",
                    "channel": channel,
                    "content": chunk
                })
