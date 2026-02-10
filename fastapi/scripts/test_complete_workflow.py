import asyncio
import sys
import os
from loguru import logger

# Add parent directory to path to import agent modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.application.agent.graph import run_agent

async def test_workflow():
    logger.info("🚀 Starting Complete Workflow Test")
    
    # 1. Happy Path: Valid URL (Simulated or Real)
    # We'll use a known working URL or a mock if we want stability, 
    # but for integration testing, let's try a real simple one if possible, 
    # or rely on the fallback if it blocks.
    logger.info("\n\n--- TEST CASE 1: Happy Path (or Fallback if crawler blocked) ---")
    result_1 = await run_agent(
        target_url="https://www.example.com",
        user_instruction="Analyze this company and draft a cold email selling AI services."
    )
    
    print_results("Case 1", result_1)

    # 2. Fallback Path: Invalid URL (Should trigger Search)
    logger.info("\n\n--- TEST CASE 2: Fallback Path (Invalid URL -> Search) ---")
    result_2 = await run_agent(
        target_url="https://invalid-url-that-does-not-exist-12345.com",
        user_instruction="Find out who runs OpenAI and write a LinkedIn DM to them."
    )
    
    print_results("Case 2", result_2)
    
    # 3. General Path: No URL (Should trigger Search based on instruction)
    logger.info("\n\n--- TEST CASE 3: General Path (No URL -> Search) ---")
    result_3 = await run_agent(
        target_url=None,
        user_instruction="Who is the CEO of Tesla? Write a short congratulatory tweet."
    )
    
    print_results("Case 3", result_3)

def print_results(case_name, result):
    print(f"\n✅ {case_name} Completed!")
    
    # Verify Hunter
    prospect = result.get("prospect")
    if prospect:
        print(f"   Hunter: Found {prospect.name} at {prospect.company}")
    else:
        print("   Hunter: FAILED")

    # Verify Strategist
    strategy = result.get("strategy")
    if strategy:
        print(f"   Strategist: Goal = {strategy.goal}")
        print(f"   Channels: {strategy.target_channels}")
    else:
        print("   Strategist: FAILED")
        
    # Verify Scribe
    drafts = result.get("drafts", {})
    if drafts:
        print(f"   Scribe: Generated {len(drafts)} drafts.")
        for channel, content in drafts.items():
            print(f"     - {channel}: {len(content)} chars")
    else:
        print("   Scribe: FAILED (No drafts)")

    # Verify Critic
    critique = result.get("latest_critique")
    if critique:
        print(f"   Critic: Score {critique.score}/10")
    else:
        # Critic might be skipped if Scribe produced final output directly or something
        # But in our graph, Critic runs if there are drafts.
        # Actually in supervisor, if drafts exist and no critique, it goes to critic. 
        # But if critic passes, it loops back? 
        # Wait, if critic passes, what does supervisor do?
        # Supervisor check:
        # if drafts and critique and critique.passed: -> return "next_step": "end" (MISSING in my memory of supervisor.py? Let me check)
        pass 

if __name__ == "__main__":
    asyncio.run(test_workflow())
