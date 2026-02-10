"""
Agent graph implementation using LangGraph.
Implements the 'Deep-Psych' Superior Agent Pattern with parallel analysis.
"""
import asyncio
from typing import Dict, Any, AsyncGenerator, List
from types import SimpleNamespace
from langgraph.graph import StateGraph, END
from loguru import logger
from functools import lru_cache
from langsmith import traceable

from .schemas import AgentState
from .nodes import (
    hunter_node, profiler_node, strategist_node,
    scribe_node, critic_node
)
from .supervisor import supervisor_node


def _state_get(state: AgentState, key: str, default=None):
    if isinstance(state, dict):
        return state.get(key, default)
    return getattr(state, key, default)


def _state_to_dict(state: AgentState) -> Dict[str, Any]:
    if isinstance(state, dict):
        return dict(state)
    if hasattr(state, "model_dump"):
        return state.model_dump()
    if hasattr(state, "__dict__"):
        return dict(state.__dict__)
    return dict(state)


def _state_to_namespace(state: AgentState) -> SimpleNamespace:
    return SimpleNamespace(**_state_to_dict(state))


def route_supervisor(state: AgentState) -> str:
    return _state_get(state, "next_step") or END


async def parallel_analysis_node(state: AgentState) -> AgentState:
    """
    Run profiler and strategist concurrently without LangGraph ParallelNode.
    Merge their outputs deterministically.
    """
    # Create shallow copies to avoid concurrent mutation of logs
    base_logs = list(_state_get(state, "logs", []))
    state_prof = _state_to_namespace(state)
    state_strat = _state_to_namespace(state)
    state_prof.logs = list(base_logs)
    state_strat.logs = list(base_logs)

    prof_res, strat_res = await asyncio.gather(
        profiler_node(state_prof),
        strategist_node(state_strat)
    )

    merged_logs = list(dict.fromkeys((prof_res.get("logs", []) + strat_res.get("logs", []))))

    return {
        "psych": prof_res.get("psych"),
        "strategy": strat_res.get("strategy"),
        "logs": merged_logs
    }


@lru_cache(maxsize=1)
def create_agent_graph():
    logger.info("Initializing Hive Mind Agent Graph (parallel analysis)...")
    workflow = StateGraph(AgentState)

    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("hunter", hunter_node)
    workflow.add_node("profiler", profiler_node)
    workflow.add_node("strategist", strategist_node)
    workflow.add_node("parallel_analysis", parallel_analysis_node)
    workflow.add_node("scribe", scribe_node)
    workflow.add_node("critic", critic_node)

    workflow.set_entry_point("supervisor")

    workflow.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "hunter": "hunter",
            "profiler": "profiler",
            "strategist": "strategist",
            "parallel_analysis": "parallel_analysis",
            "scribe": "scribe",
            "critic": "critic",
            "end": END
        }
    )

    workflow.add_conditional_edges(
        "hunter",
        lambda state: "parallel_analysis" if _state_get(state, "prospect") else "supervisor",
        {
            "parallel_analysis": "parallel_analysis",
            "supervisor": "supervisor"
        }
    )

    workflow.add_edge("parallel_analysis", "supervisor")
    workflow.add_edge("profiler", "supervisor")
    workflow.add_edge("strategist", "supervisor")
    workflow.add_edge("scribe", "supervisor")
    workflow.add_edge("critic", "supervisor")

    return workflow.compile()


@traceable(name="Run Agent (Batch)")
async def run_agent(
    target_url: str = None,
    user_instruction: str = "Introduce yourself",
    conversation_history: List[Dict[str, str]] = None,
    **kwargs
) -> Dict[str, Any]:
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


@traceable(name="Stream Agent")
async def stream_agent(
    user_instruction: str,
    target_url: str = None,
    conversation_history: List[Dict[str, str]] = None,
    **kwargs
) -> AsyncGenerator[Dict[str, Any], None]:
    graph = create_agent_graph()

    initial_state = {
        "target_url": target_url,
        "user_instruction": user_instruction,
        "drafts": {},
        "revision_count": 0,
        "logs": [],
        "conversation_history": conversation_history or []
    }

    async for event in graph.astream(initial_state):
        node_name = list(event.keys())[0]
        try:
            state_update = event[node_name]
        except KeyError:
            continue

        drafts = _state_get(state_update, "drafts", {}) or {}
        latest_draft_text = "\n\n".join([f"== {k} ==\n{v}" for k, v in drafts.items()]) if drafts else None

        yield {
            "node": node_name,
            "logs": _state_get(state_update, "logs", []),
            "current_draft": latest_draft_text,
            "final_output": _state_get(state_update, "final_output")
        }


async def stream_agent_events(
    target_url: str,
    user_instruction: str,
    conversation_history: List[Dict[str, str]] = None,
    **kwargs
) -> AsyncGenerator[Any, None]:
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
