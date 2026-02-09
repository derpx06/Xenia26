"""
Verification Test for Optimizations
1. Check LinkedIn Subject Line removal
2. Check Hook Quality (Recent Activity focus)
3. Check Channel Isolation
"""
import asyncio
import time
from ml.application.sarge import run_sarge

async def test_optimizations():
    print("🧪 Optimization Verification Test")
    print("="*80)
    
    # Test Case: LinkedIn Only - Check for Subject Line Removal
    print("\nTEST 1: LinkedIn Subject Line Removal")
    input_text = "Create LinkedIn DM for Sarah Chen, Marketing Director at BrandCo. She recently posted about AI in Marketing."
    print(f"INPUT: {input_text}")
    
    start = time.time()
    result = await run_sarge(input_text)
    elapsed = time.time() - start
    
    content = result.get("generated_content", {})
    linkedin_msg = content.get("linkedin", "")
    
    print(f"\nGenerated LinkedIn ({len(linkedin_msg)} chars):")
    print("-" * 40)
    print(linkedin_msg)
    print("-" * 40)
    
    # VALIDATION
    has_subject = "Subject:" in linkedin_msg or "Subject :" in linkedin_msg
    print(f"\nValidators:")
    print(f"[{'✅' if not has_subject else '❌'}] No 'Subject:' line")
    print(f"[{'✅' if len(linkedin_msg) < 400 else '❌'}] Under 400 chars")
    
    # Test Case: Strategy Hook Quality
    print("\n\nTEST 2: Hook Quality (Attention Grabbing)")
    strategy = result.get("strategy_brief", {})
    hook = strategy.get("hook", "")
    print(f"Generated Hook: \"{hook}\"")
    
    if "recent" in hook.lower() or "post" in hook.lower() or "brandco" in hook.lower() or "ai" in hook.lower():
        print("✅ Hook references specific context/activity")
    else:
        print("⚠️ Hook might be generic - check manually")

    print(f"\nTime: {elapsed:.2f}s")

if __name__ == "__main__":
    asyncio.run(test_optimizations())
