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
from .supervisor import supervisor_node

def route_supervisor(state: AgentState) -> str:
    """
    Reads the supervisor's decision and routes to the next node.
    """
    return state.get("next_step", END)

@lru_cache(maxsize=1)
def create_agent_graph():
    """
    Builds the Hierarchical Supervisor-Worker Graph (Hive Mind).
    """
    logger.info("Initializing Hive Mind Agent Graph...")
    workflow = StateGraph(AgentState)
    
    # --- Add Nodes ---
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("hunter", hunter_node)
    workflow.add_node("profiler", profiler_node)
    workflow.add_node("strategist", strategist_node)
    workflow.add_node("scribe", scribe_node)
    workflow.add_node("critic", critic_node)
    
    # --- Define Flow ---
    # 1. Start at Supervisor
    workflow.set_entry_point("supervisor")
    
    # 2. Supervisor decides where to go
    workflow.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "hunter": "hunter",
            "profiler": "profiler",
            "strategist": "strategist",
            "scribe": "scribe",
            "critic": "critic",
            "end": END
        }
    )
    
    # 3. All workers report back to Supervisor
    workflow.add_edge("hunter", "supervisor")
    workflow.add_edge("profiler", "supervisor")
    workflow.add_edge("strategist", "supervisor")
    workflow.add_edge("scribe", "supervisor")
    workflow.add_edge("critic", "supervisor")
    
    return workflow.compile()

# --- Entry Points for Server Compatibility ---

async def run_agent(
    target_url: str = None, # Made Optional
    user_instruction: str = "Introduce yourself",
    conversation_history: List[Dict[str, str]] = None,
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
        "drafts": {},
        "revision_count": 0,
        "logs": [],
        "conversation_history": conversation_history or []
    }
    
    result = await graph.ainvoke(initial_state)
    return result

async def stream_agent(
    user_instruction: str,
    target_url: str = None,
    conversation_history: List[Dict[str, str]] = None,
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
        "drafts": {},
        "revision_count": 0,
        "logs": [],
        "conversation_history": conversation_history or []
    }
    
    # Stream the graph state
    async for event in graph.astream(initial_state):
        # Event is a dict like {'hunter': {state...}}
        node_name = list(event.keys())[0]
        try:
            state_update = event[node_name]
        except KeyError:
             # handle complex graph events if needed
             continue
        
        # We can yield a format that your frontend expects
        # Here we yield the full state, but you can filter
        
        # Helper to get latest draft as string if needed
        drafts = state_update.get("drafts", {})
        latest_draft_text = "\n\n".join([f"== {k} ==\n{v}" for k,v in drafts.items()]) if drafts else None
        
        yield {
            "node": node_name,
            "logs": state_update.get("logs", []),
            "current_draft": latest_draft_text,
            "final_output": state_update.get("final_output") # This is now a Dict
        }

async def stream_agent_events(
    target_url: str,
    user_instruction: str,
    conversation_history: List[Dict[str, str]] = None,
    **kwargs
) -> AsyncGenerator[Any, None]:
    """
    Granular streaming of events (LLM tokens, tool calls).
    """
    graph = create_agent_graph()
    
    initial_state = {
        "target_url": target_url,
        "user_instruction": user_instruction,
        "drafts": {},
        "revision_count": 0,
        "logs": [],
        "conversation_history": conversation_history or []
    }
    
    async for event in graph.astream_events(initial_state, version="v2"):
        yield event