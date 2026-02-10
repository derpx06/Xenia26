import asyncio
import json
from ml.application.agent.streaming import stream_agent_response

async def main():
    async for chunk in stream_agent_response("Research AI agents and write a short LinkedIn post"):
        if chunk.startswith("data: "):
            data = json.loads(chunk[6:])
            if data.get("type") == "thought":
                print(f"Thought: {data.get('content')}")
            if data.get("type") == "response":
                print("\n" + "="*50)
                print("FINAL RESPONSE:")
                print(data.get("content"))
                print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
