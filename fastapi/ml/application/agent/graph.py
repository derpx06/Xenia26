"""
Agent graph implementation using LangGraph.
"""
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from loguru import logger
from functools import lru_cache

from .tools import TOOLS


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    iterations: int


# Cache compiled graphs by model name
@lru_cache(maxsize=10)
def create_agent_graph(model_name: str = "mistral:7b", max_iterations: int = 10):
    """
    Create a LangGraph agent with tool calling capabilities.
    
    Args:
        model_name: Ollama model to use
        max_iterations: Maximum iterations to prevent infinite loops
        
    Returns:
        Compiled LangGraph agent
    """
    logger.info(f"Creating agent graph with model: {model_name}")
    
    # System prompt - VERY directive about tool use
    system_prompt = """You are an AI assistant with these tools:
- duckduckgo_search: Search the web
- scrape_article: Read webpage content
- generate_email: Create outreach emails

MANDATORY RULES:
1. If user asks about current events, news, trends, or anything timely → YOU MUST call duckduckgo_search
2. If user provides a URL → YOU MUST call scrape_article
3. If user asks to generate/create/write an email → YOU MUST call generate_email
4. DO NOT try to answer from memory for current information - ALWAYS use tools
5. DO NOT explain what you're doing - just call the tool

REQUIRED ACTIONS:
- "search for X" → call duckduckgo_search(query="X")
- "latest X news" → call duckduckgo_search(query="latest X news")
- "read URL" → call scrape_article(url="URL")
- "generate email" → call generate_email(...)

After getting tool results, present clean answers WITHOUT mentioning you used tools."""
    
    # Initialize the LLM with tools - higher temperature for better tool calling
    llm = ChatOllama(model=model_name, temperature=0.3)
    llm_with_tools = llm.bind_tools(TOOLS)
    
    # Define the agent node
    def agent(state: AgentState) -> AgentState:
        """Agent node that decides whether to use tools or respond."""
        messages = state["messages"]
        iterations = state.get("iterations", 0)
        
        # Add system prompt if this is the first message or if it's missing
        if len(messages) == 1 or not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + list(messages)
        
        # Get response from LLM
        response = llm_with_tools.invoke(messages)
        
        return {
            "messages": messages + [response],
            "iterations": iterations + 1
        }
    
    # Define conditional edge logic
    def should_continue(state: AgentState) -> str:
        """Determine if agent should continue or end."""
        messages = state["messages"]
        last_message = messages[-1]
        iterations = state.get("iterations", 0)
        
        # Check if max iterations reached
        if iterations >= max_iterations:
            logger.warning(f"Max iterations ({max_iterations}) reached")
            return "end"
        
        # If last message has tool calls, continue to tools
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            logger.debug(f"Agent has {len(last_message.tool_calls)} tool calls, continuing to tools")
            return "continue"
        
        # Otherwise, end the conversation
        logger.debug("No tool calls, ending conversation")
        return "end"
    
    # Create tool node
    tool_node = ToolNode(TOOLS)
    
    # Build the graph
    workflow = StateGraph(AgentState)
    
    # Add nodes - use the correct function name "agent"
    workflow.add_node("agent", agent)
    workflow.add_node("tools", tool_node)
    
    # Set entry point
    workflow.set_entry_point("agent")
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "continue": "tools",
            "end": END
        }
    )
    
    # Add edge from tools back to agent
    workflow.add_edge("tools", "agent")
    
    # Compile and return
    compiled_graph = workflow.compile()
    logger.info(f"Agent graph ready for model: {model_name} (cached for reuse)")
    return compiled_graph


def run_agent(
    message: str,
    model: str = "mistral:7b",
    conversation_history: list = None,
    max_iterations: int = 10
):
    """
    Run the agent synchronously.
    
    Args:
        message: User's message
        model: Ollama model name
        conversation_history: Previous conversation messages
        max_iterations: Maximum iterations
        
    Returns:
        Final agent response
    """
    graph = create_agent_graph(model, max_iterations)
    
    # Build message history
    messages = []
    if conversation_history:
        for msg in conversation_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
    
    # Add current message
    messages.append(HumanMessage(content=message))
    
    # Run the graph
    initial_state = {"messages": messages, "iterations": 0}
    final_state = graph.invoke(initial_state)
    
    # Extract final response
    last_message = final_state["messages"][-1]
    
    return {
        "response": last_message.content if hasattr(last_message, "content") else str(last_message),
        "iterations": final_state.get("iterations", 0),
        "messages": final_state["messages"]
    }


async def stream_agent(
    message: str,
    model: str = "mistral:7b",
    conversation_history: list = None,
    max_iterations: int = 10
):
    """
    Stream agent execution.
    
    Args:
        message: User's message
        model: Ollama model name
        conversation_history: Previous conversation messages
        max_iterations: Maximum iterations
        
    Yields:
        State updates as the agent executes
    """
    graph = create_agent_graph(model, max_iterations)
    
    # Build message history
    messages = []
    if conversation_history:
        for msg in conversation_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
    
    # Add current message
    messages.append(HumanMessage(content=message))
    
    # Stream the graph execution
    initial_state = {"messages": messages, "iterations": 0}
    
    async for event in graph.astream(initial_state):
        yield event
