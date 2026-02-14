import operator
from typing import Annotated, Any, Dict, List, TypedDict


class AgentState(TypedDict, total=False):
    topic: str
    writing_brief: Dict[str, Any]
    sub_topics: List[str]
    gathered_notes: Annotated[List[str], operator.add]
    image_candidates: Annotated[List[str], operator.add]
    research_bible: str
    outline: List[Dict[str, Any]]
    current_section_index: int
    draft_sections: Dict[int, str]
    final_article: str
    logs: Annotated[List[str], operator.add]


class WorkerState(TypedDict):
    sub_topic: str
    topic: str
