from typing import Literal
from loguru import logger
from .schemas import AgentState

def supervisor_node(state: AgentState) -> AgentState:
    """
    The Brain of the Hive Mind.
    Decides which worker node should act next based on the current state.
    """
    # 1. HUNTER: Get basic facts
    if not state.prospect or not state.prospect.company:
        return {"next_step": "hunter"}

    # 2. PROFILER + STRATEGIST: Run in parallel when both missing
    if not state.psych and not state.strategy:
        return {"next_step": "parallel_analysis"}

    # 3. PROFILER: Get personality
    if not state.psych:
        return {"next_step": "profiler"}

    # 4. STRATEGIST: Get plan
    if not state.strategy:
        return {"next_step": "strategist"}

    # 5. SCRIBE: Write content
    drafts = state.drafts
    critique = state.latest_critique

    if not drafts:
        return {"next_step": "scribe"}

    if critique and not critique.passed:
        if state.revision_count > 3:
            logger.warning("SUPERVISOR: Max revisions reached. Forcing END.")
            return {"next_step": "end"}
        return {"next_step": "scribe"}

    # 6. CRITIC: Review content
    if drafts and critique is None:
        return {"next_step": "critic"}

    # 7. END
    return {"next_step": "end"}
