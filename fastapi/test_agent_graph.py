import asyncio
import os
from ml.application.agent.graph import create_agent_graph
from langchain_core.messages import HumanMessage

# Mock settings
os.environ["LLM_MODEL"] = "qwen2.5:7b"

async def main():
    print("Testing Agent Graph Tool Calling...")
    
    graph = create_agent_graph(model_name="qwen2.5:7b")
    
    query = "Search for Xenia"
    messages = [HumanMessage(content=query)]
    
    print(f"Query: {query}")
    
    try:
        # Run state graph
        result = await graph.ainvoke({"messages": messages, "iterations": 0})
        last_message = result["messages"][-1]
        
        print("\nLast Message Type:", type(last_message))
        print("Content:", last_message.content)
        print("Tool Calls:", last_message.tool_calls)
        
        if last_message.tool_calls:
            print("\n✅ SUCCESS: Agent emitted tool calls.")
        else:
            print("\n❌ FAILURE: No tool calls. Agent might be just talking.")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
