"""
Efficient streaming implementation for agent responses.
"""
import json
import re
from typing import AsyncGenerator
from loguru import logger

from .schemas import AgentStreamChunk
from ml.settings import settings


def _format_multi_channel_output(drafts: dict) -> str:
    """Format multi-channel drafts into a single Markdown string."""
    if not drafts:
        return ""
    parts = []
    for channel, content in drafts.items():
        title = channel.replace("_", " ").title()
        parts.append(f"## {title}\n{content}")
    return "\n\n".join(parts).strip()


def _state_get(state, key, default=None):
    if isinstance(state, dict):
        return state.get(key, default)
    return getattr(state, key, default)


async def stream_agent_response(
    message: str,
    model: str = settings.LLM_MODEL,
    conversation_history: list = None,
    max_iterations: int = 10
) -> AsyncGenerator[str, None]:
    """
    Stream agent responses as Server-Sent Events.
    """
    try:
        logger.info(f"Starting agent stream for message: {message[:50]}...")
        
        # We now use the simplified stream_agent from graph.py
        from .graph import stream_agent

        # Extract target_url and user_instruction
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, message)

        if urls:
            target_url = urls[0]
            user_instruction = message.replace(target_url, "").strip() or "Analyze this"
        else:
            target_url = None
            user_instruction = message

        iteration_count = 0
        sent_log_count = 0
        last_draft_keys = set()
        last_phase = None
        final_sent = False
        seen_prospect = False
        seen_psych = False
        seen_strategy = False
        seen_critique = False
        seen_intent = False
        seen_topic_lock = False
        seen_search_decision = False

        async for state_update in stream_agent(
            user_instruction=user_instruction,
            target_url=target_url,
            conversation_history=conversation_history
        ):
            node_name = _state_get(state_update, "node")
            logs = _state_get(state_update, "logs", [])
            final_output = _state_get(state_update, "final_output")

            iteration_count += 1

            if node_name and node_name != last_phase:
                phase_chunk = AgentStreamChunk(
                    type="thought",
                    content=f"[PHASE] {node_name.upper()} complete"
                )
                yield f"data: {phase_chunk.model_dump_json()}\n\n"
                last_phase = node_name

            # --- NEW: Structured phase events for intent router ---
            intent_category = _state_get(state_update, "intent_category")
            if intent_category and not seen_intent:
                phase_chunk = AgentStreamChunk(
                    type="phase",
                    content="intent_classified",
                    metadata={"category": intent_category}
                )
                yield f"data: {phase_chunk.model_dump_json()}\n\n"
                seen_intent = True

            topic_lock = _state_get(state_update, "topic_lock")
            if topic_lock and not seen_topic_lock:
                phase_chunk = AgentStreamChunk(
                    type="phase",
                    content="topic_locked",
                    metadata={"topic": topic_lock}
                )
                yield f"data: {phase_chunk.model_dump_json()}\n\n"
                seen_topic_lock = True

            needs_search = _state_get(state_update, "needs_search")
            if needs_search is not None and not seen_search_decision:
                phase_chunk = AgentStreamChunk(
                    type="phase",
                    content="search_decision",
                    metadata={"needs_search": needs_search}
                )
                yield f"data: {phase_chunk.model_dump_json()}\n\n"
                seen_search_decision = True

            if logs:
                current_log_count = len(logs)
                if current_log_count > sent_log_count:
                    new_logs = logs[sent_log_count:]
                    for log_entry in new_logs:
                        # Ensure log is a string
                        log_str = str(log_entry)
                        chunk = AgentStreamChunk(
                            type="thought",
                            content=f"[{node_name.upper()}] {log_str}" if not log_str.startswith("[") else log_str
                        )
                        yield f"data: {chunk.model_dump_json()}\n\n"

                    sent_log_count = current_log_count

            prospect = _state_get(state_update, "prospect")
            if prospect and not seen_prospect:
                if isinstance(prospect, dict):
                    name = prospect.get("name", "Prospect")
                    role = prospect.get("role", "Role")
                    company = prospect.get("company", "Company")
                else:
                    name = getattr(prospect, "name", "Prospect")
                    role = getattr(prospect, "role", "Role")
                    company = getattr(prospect, "company", "Company")
                chunk = AgentStreamChunk(
                    type="thought",
                    content=f"[MILESTONE] Persona extracted: {name} | {role} @ {company}"
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
                seen_prospect = True

            psych = _state_get(state_update, "psych")
            if psych and not seen_psych:
                if isinstance(psych, dict):
                    style = psych.get("communication_style", "Unknown")
                    disc = psych.get("disc_type", "Unknown")
                else:
                    style = getattr(psych, "communication_style", "Unknown")
                    disc = getattr(psych, "disc_type", "Unknown")
                chunk = AgentStreamChunk(
                    type="thought",
                    content=f"[MILESTONE] Tone inferred: {style} (DISC {disc})"
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
                seen_psych = True

            strategy = _state_get(state_update, "strategy")
            if strategy and not seen_strategy:
                if isinstance(strategy, dict):
                    channels = strategy.get("target_channels", []) or []
                    goal = strategy.get("goal", "")
                else:
                    channels = getattr(strategy, "target_channels", None) or []
                    goal = getattr(strategy, "goal", "")
                chunk = AgentStreamChunk(
                    type="thought",
                    content=f"[MILESTONE] Strategy ready: {', '.join(channels)} | Goal: {goal}"
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
                seen_strategy = True

            drafts = _state_get(state_update, "drafts", {}) or {}
            if drafts:
                new_keys = set(drafts.keys()) - last_draft_keys
                for ch in sorted(new_keys):
                    chunk = AgentStreamChunk(
                        type="thought",
                        content=f"[MILESTONE] Draft generated: {ch}"
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"
                last_draft_keys = set(drafts.keys())

            critique = _state_get(state_update, "latest_critique")
            if critique and not seen_critique:
                if isinstance(critique, dict):
                    score = critique.get("score", None)
                    feedback = critique.get("feedback", "")
                else:
                    score = getattr(critique, "score", None)
                    feedback = getattr(critique, "feedback", "")
                chunk = AgentStreamChunk(
                    type="thought",
                    content=f"[MILESTONE] Critique: {score}/10 | {feedback}"
                )
                yield f"data: {chunk.model_dump_json()}\n\n"
                seen_critique = True

            if final_output and not final_sent:
                if isinstance(final_output, dict):
                    final_text = _format_multi_channel_output(final_output)
                else:
                    final_text = str(final_output)
                chunk = AgentStreamChunk(
                    type="response",
                    content=final_text
                )
                yield f"data: {chunk.model_dump_json()}\n\n"

                done_chunk = AgentStreamChunk(
                    type="done",
                    content=final_text,
                    metadata={"iterations": iteration_count}
                )
                yield f"data: {done_chunk.model_dump_json()}\n\n"
                final_sent = True
                break

    except Exception as e:
        # --- FIX 2: SAFE LOGGING (PREVENTS CRASH) ---
        import json
        
        # Log without f-string formatting on the exception object to avoid KeyError
        logger.error("Error during agent streaming: {err}", err=str(e))
        
        error_content = str(e)
        if isinstance(e, dict):
            error_content = json.dumps(e)
        elif hasattr(e, 'message'): 
            error_content = e.message
            
        yield f"data: {json.dumps({'type': 'error', 'content': error_content})}\n\n"
        # --------------------------------------------


def format_final_response(events: list) -> dict:
    """
    Extract and format the final response from agent events.
    """
    final_response = ""
    tool_calls = []
    iterations = 0

    for event in events:
        if "agent" in event:
            messages = event["agent"].get("messages", [])
            if messages:
                last_message = messages[-1]
                if hasattr(last_message, "content") and last_message.content:
                    final_response = last_message.content

                if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                    for tc in last_message.tool_calls:
                        tool_calls.append({
                            "name": tc.get("name"),
                            "input": tc.get("args")
                        })

            iterations = event["agent"].get("iterations", iterations)

    return {
        "response": final_response,
        "tool_calls": tool_calls,
        "iterations": iterations
    }