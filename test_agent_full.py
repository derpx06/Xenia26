
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'fastapi/.env'))

# Ensure the project root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'fastapi')))

from ml.ollama_deep_researcher.graph import graph as app
from langchain_core.runnables import RunnableConfig

async def test_agent_output():
    topic = "The Future of AI in Sales"
    print(f"Testing Agent with Topic: '{topic}'")
    
    config = RunnableConfig(configurable={"thread_id": "test-thread-1"})
    result = await app.ainvoke({"topic": topic}, config)
    
    print("\n--- FINAL OUTPUT ---")
    print(result.get("final_article"))
    
    print("\n--- LOGS ---")
    for log in result.get("logs", []):
        print(log)

if __name__ == "__main__":
    asyncio.run(test_agent_output())
