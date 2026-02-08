from typing import Literal
from loguru import logger
from .schemas import AgentState

def supervisor_node(state: AgentState) -> AgentState:
    """
    The Brain of the Hive Mind.
    Decides which worker node should act next based on the current state.
    """
    # 1. HUNTER: Get basic facts
    if not state.get("prospect") or not state["prospect"].company:
        return {"next_step": "hunter"}

    # 2. PROFILER: Get personality
    if not state.get("psych"):
        return {"next_step": "profiler"}

    # 3. STRATEGIST: Get plan
    if not state.get("strategy"):
        return {"next_step": "strategist"}

    # 4. SCRIBE: Write content
    # We write if:
    # a) No drafts exist yet
    # b) We have a critique that says "Fail" (iteration loop)
    drafts = state.get("drafts", {})
    critique = state.get("latest_critique")
    
    if not drafts:
        return {"next_step": "scribe"}
    
    if critique and not critique.passed:
        # Check if we hit max revisions (optional check, but good for safety)
        if state.get("revision_count", 0) > 3:
            logger.warning("👑 SUPERVISOR: Max revisions reached. Forcing END.")
            return {"next_step": "end"}
        return {"next_step": "scribe"}

    # 5. CRITIC: Review content
    # We critique if:
    # a) We have drafts AND
    # b) We do NOT have a critique for the *current* drafts
    # How to know? We'll enforce that Scribe CLEARS the 'latest_critique' field.
    # So if latest_critique is None, it means Scribe just ran.
    if drafts and critique is None:
        return {"next_step": "critic"}

    # 6. END
    return {"next_step": "end"}
