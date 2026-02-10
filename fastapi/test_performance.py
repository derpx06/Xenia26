import asyncio
import time
import json
from ml.application.agent.streaming import stream_agent_response

async def test_performance(message: str):
    print(f"\n🚀 Testing Performance for: '{message}'")
    start_time = time.time()
    node_times = {}
    last_node = None
    node_start = start_time
    
    print("-" * 50)
    async for chunk in stream_agent_response(message):
        if chunk.startswith("data: "):
            try:
                data = json.loads(chunk[6:])
                chunk_type = data.get("type")
                content = data.get("content", "")
                
                if chunk_type == "thought" and content.startswith("["):
                    # Extract node name from [NODE_NAME]
                    node_name = content.split("]")[0][1:]
                    if node_name != last_node:
                        now = time.time()
                        if last_node:
                            duration = now - node_start
                            node_times[last_node] = duration
                            print(f"⏱️  {last_node}: {duration:.2f}s")
                        last_node = node_name
                        node_start = now
                
                if chunk_type == "done":
                    if last_node:
                        duration = time.time() - node_start
                        node_times[last_node] = duration
                        print(f"⏱️  {last_node}: {duration:.2f}s")
                    break
                    
            except Exception as e:
                print(f"Error parsing chunk: {e}")

    total_time = time.time() - start_time
    print("-" * 50)
    print(f"✅ Total Execution Time: {total_time:.2f}s")
    return node_times, total_time

if __name__ == "__main__":
    test_message = "Research AI agents and write a short LinkedIn post"
    asyncio.run(test_performance(test_message))
