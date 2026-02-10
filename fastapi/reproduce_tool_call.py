import os
import sys
import asyncio
from langchain_ollama import ChatOllama
from langchain_core.tools import tool

# Mock settings
os.environ["LLM_MODEL"] = "qwen2.5:7b"

@tool
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

async def main():
    print("Testing Qwen2.5 Tool Calling...")
    
    llm = ChatOllama(model="qwen2.5:7b", temperature=0)
    tools = [add]
    llm_with_tools = llm.bind_tools(tools)
    
    query = "What is 55 + 12?"
    print(f"Query: {query}")
    
    try:
        response = await llm_with_tools.ainvoke(query)
        print("\nResponse:", response)
        print("\nTool Calls:", response.tool_calls)
        
        if not response.tool_calls:
            print("\n❌ FAILURE: No tool calls generated.")
        else:
            print("\n✅ SUCCESS: Tool calls generated.")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
