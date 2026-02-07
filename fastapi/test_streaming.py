
import asyncio
import json
from ml.application.agent.streaming import stream_agent_response

async def main():
    print("Starting stream test...")
    async for chunk in stream_agent_response("Research AI agents"):
        print(f"CHUNK: {chunk.strip()}")

if __name__ == "__main__":
    asyncio.run(main())
