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
from pydantic import BaseModel, BeforeValidator
import instructor
from instructor import llm_validator

from ml.settings import settings
from .tools import TOOLS
from agent_style_transfer.schemas import Document, ContentType, DocumentCategory
from agent_style_transfer.llm_provider_setup import get_instructor_client
from .writing_style_inferrer import infer_style_rules


class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    iterations: int


def extract_context_documents(messages: Sequence[BaseMessage]) -> list[Document]:
    """Extract context documents from tool messages."""
    documents = []
    seen_content = set()
    
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.name == "scrape_article":
            if msg.content in seen_content:
                continue
            seen_content.add(msg.content)
            
           
            documents.append(
                Document(
                    url="http://generated-from-tool.com", 
                    type=ContentType.BLOG, 
                    category=DocumentCategory.PROFESSIONAL,
                    title=f"Context from {msg.name}",
                    content=msg.content
                )
            )
            
    return documents


# Cache compiled graphs by model name
@lru_cache(maxsize=10)
def create_agent_graph(model_name: str = settings.LLM_MODEL, max_iterations: int = 10):
    """
    Create a LangGraph agent with tool calling capabilities.
    
    Args:
        model_name: Ollama model to use
        max_iterations: Maximum iterations to prevent infinite loops
        
    Returns:
        Compiled LangGraph agent
    """
    logger.info(f"Creating agent graph with model: {model_name}")
    
    # System prompt - Clear about when to use tools vs when to respond
    system_prompt = """You are an autonomous AI agent capable of executing complex tasks.

TOOLS:
- duckduckgo_search: Web search for current information
- scrape_article: Extract data from ANY URL (GitHub, LinkedIn, Twitter, Medium, etc.)
- generate_email: Create fully personalized emails
- wikipedia_search: Search for definitions, history, and general knowledge

CORE BEHAVIORS:
1. **Be Autonomous**: If a user asks for a task that involves multiple steps (e.g., "Find X and email Y"), DO IT ALL. Do not stop to ask for permission for every small step unless critically necessary.
2. **Be Proactive**: If you find information that suggests a next logical step, take it. For example, if you find a LinkedIn profile, you might check their GitHub if relevant.
3. **Use Tools Decisively**:
   - URL provided? -> Call `scrape_article` IMMEDIATELY.
   - Need info? -> Call `duckduckgo_search` or `wikipedia_search` IMMEDIATELY.
   - need to write? -> Call `generate_email`.

GLASS BOX STREAMING:
You must stream your thought process using `[Thinking]` tags.

Structure your response like this:
[Thinking] I need to find information about X...
... (Call Tool) ...
[Answer] Here is the information...

WHEN TO USE TOOLS vs TEXT:
- **TOOLS**: When you need to gather data, take action, or generate specific content. preferred over asking questions.
- **TEXT**: Only when you have completed the requested task, checking for critical ambiguity that blocks progress, or summarizing results.

CRITICAL RULES:
1. **NEVER make up data**. If you don't have it, SEARCH for it or SCRAPE it.
2. **Do not narrate your plan**. Just Execute it. Don't say "I will now search for..." -> Just call the search tool.
3. **Chain Actions**: You can call tools, get results, and then call MORE tools based on those results in a loop.
4. **Assume Consent**: For read-only actions (search, scrape), assume the user wants you to proceed.
5. **After Generating Content**: If you generate an email, ALWAYS say something like "I have drafted the email below. You can use the button to send it." Do not just output the draft and stop.

REMEMBER: Your goal is to COMPLETE the task efficiently.
1. If you found the info,and have enough confidence STOP and Answer.
2. MANDATORY: You MUST provide a "Final Verdict" or summary at the end. Even if the tool output is perfect, you must synthesize it into a final text response for the user.
"""

    llm = ChatOllama(model=model_name, temperature=0.9)
    llm_with_tools = llm.bind_tools(TOOLS)
    
    # Define the agent node
    def agent(state: AgentState) -> AgentState:
        """Agent node that decides whether to use tools or respond."""
        messages = state["messages"]
        iterations = state.get("iterations", 0)
        
        # Add system prompt if this is the first message or if it's missing
        if len(messages) == 1 or not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + list(messages)
       
        last_message = messages[-1]
        has_tool_calls = hasattr(last_message, "tool_calls") and last_message.tool_calls
        
        # STYLE TRANSFER SETUP
        active_style_rules = []
        context_docs = extract_context_documents(messages)
        if context_docs:
            logger.info(f"Found {len(context_docs)} context documents for style inference")
            try:
                # Use "ollama" explicitly as per configuration
                rules = infer_style_rules(context_docs, provider="ollama")
                if rules:
                    active_style_rules = rules
                    style_rules_str = "\n".join([f"- {rule}" for rule in rules])
                    style_instruction = f"""
IMPORTANT: ADAPT YOUR WRITING STYLE
Based on the gathered context, you MUST adopt the following writing style for your response:

{style_rules_str}

Ensure your final answer reflects this tone and structure.
"""
                    messages = list(messages) + [SystemMessage(content=style_instruction)]
                    logger.info("Injected style transfer rules into agent context")
            except Exception as e:
                logger.error(f"Failed to infer style rules: {e}")
        
        # Get response from LLM
        response = llm_with_tools.invoke(messages)
        
        # STRICT TONE VALIDATION
        # If we have active style rules AND the response is text (not a tool call), validate it
        if active_style_rules and not (hasattr(response, "tool_calls") and response.tool_calls):
            try:
                logger.info("Validating response tone against style rules...")
                client, _ = get_instructor_client("ollama", model=model_name)
                
                rules_text = "\n".join([f"- {r}" for r in active_style_rules])
                validator_prompt = f"Ensure the text strictly follows these email/writing style rules:\n{rules_text}"
                
                class StyledResponse(BaseModel):
                    resp: Annotated[
                        str,
                        BeforeValidator(llm_validator(validator_prompt, client=client))
                    ]
                
                # We ask the LLM to 'process' the potential output to ensure it matches the style
                # effectively using the validator to correct it if necessary
                # We create a simple prompt that asks to rewrite/validate the existing content
                validation_response = client.create(
                    response_model=StyledResponse,
                    messages=[
                        {"role": "system", "content": "You are a specific style editor. Rewrite the input text to match the required style if needed. Do not change the meaning."},
                        {"role": "user", "content": f"Text to validate/rewrite:\n{response.content}"}
                    ],
                    max_retries=2
                )
                
                # Update the response content with the validated version
                if validation_response.resp:
                    response.content = validation_response.resp
                    logger.info("Response validated and potentially adjusted for tone.")
                
            except Exception as e:
                logger.warning(f"Tone validation failed, using original response: {e}")
        
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
    model: str = settings.LLM_MODEL,
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
            # Handle dictionary input (from Pydantic model dump)
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    messages.append(AIMessage(content=content, tool_calls=tool_calls))
                else:
                    messages.append(AIMessage(content=content))
            elif role == "tool":
                tool_call_id = msg.get("tool_call_id")
                name = msg.get("name")
                if tool_call_id:
                    messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=name))
    
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
    model: str = settings.LLM_MODEL,
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
            # Handle dictionary input (from Pydantic model dump)
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    messages.append(AIMessage(content=content, tool_calls=tool_calls))
                else:
                    messages.append(AIMessage(content=content))
            elif role == "tool":
                tool_call_id = msg.get("tool_call_id")
                name = msg.get("name")
                if tool_call_id:
                    messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=name))
    
    # Add current message
    messages.append(HumanMessage(content=message))
    
    # Stream the graph execution
    initial_state = {"messages": messages, "iterations": 0}
    
    async for event in graph.astream(initial_state):
        yield event


async def stream_agent_events(
    message: str,
    model: str = settings.LLM_MODEL,
    conversation_history: list = None,
    max_iterations: int = 10
):
    """
    Stream agent execution events natively (tokens, tool calls, etc).
    
    Args:
        message: User's message
        model: Ollama model name
        conversation_history: Previous conversation messages
        max_iterations: Maximum iterations
        
    Yields:
        Granular events from astream_events
    """
    graph = create_agent_graph(model, max_iterations)
    
    # Build message history
    messages = []
    if conversation_history:
        for msg in conversation_history:
            # Handle dictionary input (from Pydantic model dump)
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    # Reconstruct AIMessage with tool calls
                    messages.append(AIMessage(content=content, tool_calls=tool_calls))
                else:
                    messages.append(AIMessage(content=content))
            elif role == "tool":
                # Reconstruct ToolMessage
                tool_call_id = msg.get("tool_call_id")
                name = msg.get("name")
                if tool_call_id:
                    messages.append(ToolMessage(content=content, tool_call_id=tool_call_id, name=name))
                else:
                    logger.warning(f"Tool message missing tool_call_id: {msg}")
    
    # Add current message
    messages.append(HumanMessage(content=message))
    
    # Stream the graph execution events
    initial_state = {"messages": messages, "iterations": 0}
    
    async for event in graph.astream_events(initial_state, version="v2"):
        yield event
