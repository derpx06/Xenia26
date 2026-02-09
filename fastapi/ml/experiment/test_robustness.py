import asyncio
import sys
import os
from loguru import logger

# Add project root
sys.path.append(os.getcwd())

from ml.application.agent.graph import run_agent
from ml.settings import settings

# Force OLLAMA_HOST for test execution context as well
os.environ["OLLAMA_HOST"] = "127.0.0.1:11434"

TEST_CASES = [
    {
        "name": "Wikipedia Profile (Real URL)",
        "url": "https://en.wikipedia.org/wiki/Sam_Altman",
        "instruction": "Draft a cold email to Sam Altman proposing a partnership on AGI safety.",
        "expected_channels": ["email"]
    },
    {
        "name": "Tech Blog (Real URL)",
        "url": "https://techcrunch.com/", 
        "instruction": "Write a LinkedIn post summarizing top news from this page.",
        "expected_channels": ["linkedin_post"]
    },
    {
        "name": "General Query (No URL)",
        "url": "",
        "instruction": "Write a generic sales pitch for coffee.",
        "expected_channels": ["general_response"] # or Strategy might pick email
    }
]

async def run_robustness_suite():
    print(f"🚀 Starting Robustness Suite with Model: {settings.LLM_MODEL}")
    results = []

    for i, test in enumerate(TEST_CASES):
        print(f"\n🔹 TEST {i+1}: {test['name']}")
        print(f"   URL: {test['url']}")
        print(f"   Instruction: {test['instruction']}")
        
        try:
            result = await run_agent(target_url=test['url'], user_instruction=test['instruction'])
            
            # Validation
            final_output = result.get("final_output", {})
            logs = result.get("logs", [])
            
            if not final_output:
                print("   ❌ FAILED: No output generated.")
                results.append((test['name'], False, "No output"))
                continue
                
            # Check for error strings
            errors = [v for k, v in final_output.items() if "[Error:" in v]
            if errors:
                print(f"   ⚠️ PARTIAL FAIL: Error in drafts: {errors}")
                results.append((test['name'], False, "Draft Error"))
                continue
                
            print(f"   ✅ SUCCESS: Generated {len(final_output)} drafts.")
            for ch, content in final_output.items():
                print(f"      - {ch}: {len(content)} chars")
            
            results.append((test['name'], True, "Success"))
            
        except Exception as e:
            print(f"   ❌ CRASHED: {e}")
            results.append((test['name'], False, str(e)))

    print("\n\n📊 --- SUMMARY ---")
    for name, success, reason in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name} | {reason}")

if __name__ == "__main__":
    asyncio.run(run_robustness_suite())
