
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

async def test_topic(topic):
    print(f"\n\n==================================================")
    print(f"TESTING TOPIC: '{topic}'")
    print(f"==================================================\n")
    
    config = RunnableConfig(configurable={"thread_id": f"test-{topic.replace(' ', '-')}"})
    deep_hits = 0
    final_article = ""

    try:
        async for chunk in app.astream({"topic": topic}, config, stream_mode="updates"):
            for node, values in chunk.items():
                if "logs" in values:
                    for log in values["logs"]:
                        print(log)
                        if "deep=" in log:
                            try:
                                parts = log.split("deep=")
                                count = int(parts[1].split(",")[0])
                                deep_hits += count
                            except:
                                pass
                if "final_article" in values:
                    final_article = values["final_article"]

        print(f"\n--- FINAL ARTICLE FOR '{topic}' ---")
        print(final_article[:500] + "...\n[TRUNCATED]\n")
        
        if deep_hits > 0:
            print(f"\n✅ SUCCESS: Deep research used {deep_hits} sources.")
        else:
            print(f"\n⚠️ WARNING: No deep research sources used.")
            
    except Exception as e:
        print(f"\n❌ ERROR testing '{topic}': {e}")

async def run_suite():
    topics = [
        "Rust vs Go for Microservices",
        "Impact of Microplastics on Human Health", 
        "The Rise of Private Credit"
    ]
    
    for topic in topics:
        await test_topic(topic)

if __name__ == "__main__":
    asyncio.run(run_suite())
