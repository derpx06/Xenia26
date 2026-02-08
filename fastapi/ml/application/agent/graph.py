"""
Agent graph implementation using LangGraph.
Implements the 'Deep-Psych' Superior Agent Pattern (DCG Architecture).
"""
import re
from typing import Dict, Any, AsyncGenerator, List
from langgraph.graph import StateGraph, END
from loguru import logger
from functools import lru_cache

# Import the new schema and nodes
from .schemas import AgentState
from .nodes import (
    hunter_node, profiler_node, strategist_node, 
    scribe_node, critic_node
)

def should_continue(state: AgentState) -> str:
    """
    The Reflexion Loop Logic.
    Decides whether to refine the draft or ship it.
    """
    critique = state.get("latest_critique")
    attempts = state.get("revision_count", 0)
    
    # 1. Quality Gate: If passed, we are done.
    if critique and critique.passed:
        logger.info("✅ CRITIC: Quality threshold met. Finishing.")
        return END
    
    # 2. Safety Valve: Don't loop forever. Max 3 revisions.
    if attempts >= 3:
        logger.warning("🛑 CRITIC: Max revisions reached. Finishing anyway.")
        return END
    
    # 3. Otherwise, go back to the drawing board.
    logger.info("🔄 CRITIC: Sending back for revision.")
    return "scribe"

@lru_cache(maxsize=1)
def create_agent_graph():
    """
    Builds the Hierarchical State Graph for the Outreach Agent.
    """
    logger.info("Initializing Superior Agent Graph...")
    workflow = StateGraph(AgentState)
    
    # --- Add Nodes ---
    workflow.add_node("hunter", hunter_node)
    workflow.add_node("profiler", profiler_node)
    workflow.add_node("strategist", strategist_node)
    workflow.add_node("scribe", scribe_node)
    workflow.add_node("critic", critic_node)
    
    # --- Define Flow ---
    # 1. Start with Research
    workflow.set_entry_point("hunter")
    
    # 2. Research -> Psychology (Conditional)
    def route_after_hunter(state: AgentState) -> str:
        """
        Router: If General Mode (no URL), skip Profiler.
        """
        prospect = state.get("prospect")
        if prospect and prospect.name == "User" and prospect.role == "General":
            logger.info("🔀 ROUTER: General Mode detected. Skipping Profiler.")
            return "strategist"
        return "profiler"

    workflow.add_conditional_edges(
        "hunter",
        route_after_hunter,
        {
            "profiler": "profiler",
            "strategist": "strategist"
        }
    )
    
    # 3. Psychology -> Strategy
    workflow.add_edge("profiler", "strategist")
    
    # 4. Strategy -> First Draft
    workflow.add_edge("strategist", "scribe")
    
    # 5. Draft -> Quality Control
    workflow.add_edge("scribe", "critic")
    
    
    # 6. Conditional Loop (Reflexion)
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {
            "scribe": "scribe", # Feedback Loop: Critic -> Scribe
            END: END            # Success: Critic -> Finish
        }
    )
    
    return workflow.compile()

# --- Entry Points for Server Compatibility ---

async def run_agent(
    target_url: str = None, # Made Optional
    user_instruction: str = "Introduce yourself",
    **kwargs
) -> Dict[str, Any]:
    """
    Main entry point for batch execution.
    user_instruction replaces 'message' or 'user_offer'.
    """
    graph = create_agent_graph()
    
    initial_state = {
        "target_url": target_url,
        "user_instruction": user_instruction,
        "drafts": [],
        "revision_count": 0,
        "logs": []
    }
    
    result = await graph.ainvoke(initial_state)
    return result

async def stream_agent(
    user_instruction: str,
    target_url: str = None,
    **kwargs
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streams the agent's progress updates.
    Yields the updated state after each node completes.
    """
    graph = create_agent_graph()
    
    initial_state = {
        "target_url": target_url,
        "user_instruction": user_instruction,
        "drafts": [],
        "revision_count": 0,
        "logs": []
    }
    
    # Stream the graph state
    async for event in graph.astream(initial_state):
        # Event is a dict like {'hunter': {state...}}
        node_name = list(event.keys())[0]
        state_update = event[node_name]
        
        # We can yield a format that your frontend expects
        # Here we yield the full state, but you can filter
        yield {
            "node": node_name,
            "logs": state_update.get("logs", []),
            "current_draft": state_update.get("drafts", [""])[-1] if state_update.get("drafts") else None,
            "final_output": state_update.get("final_output")
        }

async def stream_agent_events(
    target_url: str,
    user_instruction: str,
    **kwargs
) -> AsyncGenerator[Any, None]:
    """
    Granular streaming of events (LLM tokens, tool calls).
    """
    graph = create_agent_graph()
    
    initial_state = {
        "target_url": target_url,
        "user_instruction": user_instruction,
        "drafts": [],
        "revision_count": 0,
        "logs": []
    }
    
    async for event in graph.astream_events(initial_state, version="v2"):
        yield event