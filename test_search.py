
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'fastapi/.env'))

# Ensure the project root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'fastapi')))

from ml.ollama_deep_researcher.nodes import _tavily_search, _duckduckgo_search, Configuration

async def test_search():
    conf = Configuration()
    query = "future of AI in sales"
    
    print(f"Testing Tavily with query: '{query}'")
    try:
        tavily_res = await asyncio.to_thread(_tavily_search, conf, query, 3, False)
        print(f"Tavily Results: {len(tavily_res.get('results', []))}")
        if tavily_res.get('results'):
            print(f"Top Tavily: {tavily_res['results'][0].get('title')}")
    except Exception as e:
        print(f"Tavily Error: {e}")

    print(f"\nTesting DDG with query: '{query}'")
    try:
        ddg_res = await asyncio.to_thread(_duckduckgo_search, conf, query, 3)
        print(f"DDG Results: {len(ddg_res.get('results', []))}")
        if ddg_res.get('results'):
            print(f"Top DDG: {ddg_res['results'][0].get('title')}")
    except Exception as e:
        print(f"DDG Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())
