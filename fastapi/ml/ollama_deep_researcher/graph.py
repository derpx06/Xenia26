from typing import List

from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from .nodes import editor, orchestrator, planner, research_worker, synthesizer, writer
from .state import AgentState, WorkerState


def map_research(state: AgentState) -> List[Send]:
    sub_topics = state.get("sub_topics", [])
    writing_brief = state.get("writing_brief", {}) or {}
    root_topic = writing_brief.get("topic_focus") or state.get("topic", "offline AI implementation")
    if not sub_topics:
        sub_topics = [f"Core implementation details for {root_topic}"]
    return [Send("research_worker", WorkerState(sub_topic=topic, topic=root_topic)) for topic in sub_topics]


def continue_writing(state: AgentState) -> str:
    if state.get("current_section_index", 0) < len(state.get("outline", [])):
        return "writer"
    return "editor"


workflow = StateGraph(AgentState)
workflow.add_node("orchestrator", orchestrator)
workflow.add_node("research_worker", research_worker)
workflow.add_node("synthesizer", synthesizer)
workflow.add_node("planner", planner)
workflow.add_node("writer", writer)
workflow.add_node("editor", editor)

workflow.add_edge(START, "orchestrator")
workflow.add_conditional_edges("orchestrator", map_research, ["research_worker"])
workflow.add_edge("research_worker", "synthesizer")
workflow.add_edge("synthesizer", "planner")
workflow.add_edge("planner", "writer")
workflow.add_conditional_edges("writer", continue_writing, {"writer": "writer", "editor": "editor"})
workflow.add_edge("editor", END)

graph = workflow.compile()

if __name__ == "__main__":
    print(graph.get_graph().draw_mermaid())
