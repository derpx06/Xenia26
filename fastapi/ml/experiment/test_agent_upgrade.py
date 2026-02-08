import asyncio
import sys
import os

# Add the project root to path
sys.path.append("/home/manas/Documents/Xenia26/fastapi")

from ml.application.agent.graph import run_agent
from ml.application.agent.knowledge import SimpleKnowledgeBase
from ml.application.agent.schemas import ProspectProfile

async def test_agent_flow():
    print("🚀 Starting Agent Verification...")
    
    # 1. Setup Test Data
    target_url = "https://linkedin.com/in/test-user" # Mock URL
    instruction = "I want to reach out to this person to sell them AI services. Generate an email and a LinkedIn DM."
    
    # 2. Run Agent
    # We expect the agent to:
    # - Detect "email" and "linkedin_dm" from instruction
    # - Scrape (mocked via generic fallback if URL fails, or real if we had a crawler)
    # - Generate drafts
    # - Save to KB
    
    result = await run_agent(target_url=target_url, user_instruction=instruction)
    
    # 3. Verify Outputs
    print("\n--- Result Analysis ---")
    drafts = result.get("final_output", {})
    
    if isinstance(drafts, dict):
        print(f"✅ Generated {len(drafts)} drafts: {list(drafts.keys())}")
        for channel, content in drafts.items():
            print(f"\n[Channel: {channel}]")
            print(content[:200] + "...")
    else:
        print(f"❌ Unexpected output format: {drafts}")

    # 4. Verify Knowledge Base (Vector Store)
    print("\n--- Knowledge Base Verification (Vector Store) ---")
    kb = SimpleKnowledgeBase()
    
    # Test 1: Prospect Storage (JSON)
    prospect = result.get("prospect") # Might be None or Fallback
    if prospect:
        saved_profile = kb.get_prospect(prospect.name, prospect.company)
        if saved_profile:
             print(f"✅ JSON Storage Verified: Found {saved_profile.name}")
        else:
             print(f"❌ JSON Storage Failed: Could not find {prospect.name}")
    
    # Test 2: Semantic Search (Chroma)
    print("Testing Semantic Retrieval...")
    # Manually save a known example to ensure we have data
    from ml.application.agent.schemas import ProspectProfile, StrategyBrief, PsychProfile
    
    dummy_prospect = ProspectProfile(name="Test CEO", role="CEO", company="TestCorp")
    dummy_strategy = StrategyBrief(target_channel="email", goal="Sell AI", hook="", key_points=[], framework="", cta="")
    dummy_content = "Subject: AI Revolution\n\nHi CEO, adopt AI or die. Best, Me."
    
    kb.save_outreach(dummy_prospect, dummy_strategy, dummy_content)
    
    # Query for it
    query = "Outreach to an executive about artificial intelligence"
    results = kb.get_similar_outreach(query_text=query, role="CEO", limit=1)
    
    if results and len(results) > 0:
        match = results[0]
        print(f"✅ Vector Search Verified: Found content length {len(match['content'])}")
    else:
        print("❌ Vector Search Failed: No results found.")

    # Test 3: Psych Profile Caching
    print("Testing Psych Profile Caching...")
    # Ensure prospect exists first (Foreign Key dependency)
    kb.save_prospect(dummy_prospect)
    
    dummy_psych = PsychProfile(disc_type="D", communication_style="Direct", tone_instructions=["Be brief"], style_rules=["Rule 1"])
    kb.save_psych_profile("Test CEO", "TestCorp", dummy_psych)
    
    retrieved_psych = kb.get_psych_profile("Test CEO", "TestCorp")
    if retrieved_psych and retrieved_psych['disc_type'] == "D":
        print("✅ Psych Profile Caching Verified")
    else:
        print("❌ Psych Profile Caching Failed")

if __name__ == "__main__":
    asyncio.run(test_agent_flow())
