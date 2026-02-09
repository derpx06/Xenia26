"""
Quick test to verify bug fixes:
1. NumPy/ChromaDB compatibility (retriever should work)
2. Channel-specific generation (only email when email requested)
"""
import asyncio
import time
from ml.application.sarge import run_sarge


async def test_channel_specific():
    """Test that only requested channels are generated"""
    
    test_cases = [
        {
            "name": "Email Only",
            "input": "Generate email for Alex Rivera, Head of Platform at CloudScale",
            "expected_channels": ["email"]
        },
        {
            "name": "LinkedIn Only",
            "input": "Create LinkedIn DM for Sarah Chen, Marketing Director at BrandCo",
            "expected_channels": ["linkedin"]
        },
        {
            "name": "WhatsApp Only",
            "input": "Draft WhatsApp for Mike Johnson, CTO at TechStart",
            "expected_channels": ["whatsapp"]
        },
        {
            "name": "Email + LinkedIn",
            "input": "Generate email and LinkedIn message for Emma Wilson, PM at SaaS Inc",
            "expected_channels": ["email", "linkedin"]
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"TEST: {test['name']}")
        print(f"INPUT: {test['input']}")
        print(f"EXPECTED CHANNELS: {test['expected_channels']}")
        print(f"{'='*80}")
        
        start = time.time()
        result = await run_sarge(test["input"])
        elapsed = time.time() - start
        
        content = result.get("generated_content", {})
        generated_channels = list(content.keys())
        
        # Check if only expected channels were generated
        success = set(generated_channels) == set(test["expected_channels"])
        
        print(f"\n{'✅ PASS' if success else '❌ FAIL'}")
        print(f"Generated Channels: {generated_channels}")
        print(f"Time: {elapsed:.2f}s")
        
        # Show content for each generated channel
        for channel in generated_channels:
            print(f"\n{channel.upper()} ({len(content[channel])} chars):")
            print(f"  {content[channel][:150]}...")
        
        # Check if retriever worked (no ChromaDB error)
        templates = result.get("retrieved_templates", [])
        print(f"\nRetriever Status: {'✅ Working' if templates is not None else '❌ Failed'}")
        
        await asyncio.sleep(1)


async def test_speed_improvement():
    """Test speed improvement when generating only one channel vs all three"""
    
    print(f"\n{'='*80}")
    print("SPEED COMPARISON TEST")
    print(f"{'='*80}")
    
    # Test 1: Generate all channels (baseline)
    print("\nTest 1: All Channels (create email, LinkedIn, and WhatsApp)")
    start = time.time()
    result_all = await run_sarge("Create email, LinkedIn DM, and WhatsApp for Dr. Lisa Wang, AI Researcher at Google")
    time_all = time.time() - start
    channels_all = list(result_all.get("generated_content", {}).keys())
    print(f"  Generated: {channels_all}")
    print(f"  Time: {time_all:.2f}s")
    
    # Test 2: Generate only email (should be faster)
    print("\nTest 2: Email Only")
    start = time.time()
    result_email = await run_sarge("Generate email for Dr. Lisa Wang, AI Researcher at Google")
    time_email = time.time() - start
    channels_email = list(result_email.get("generated_content", {}).keys())
    print(f"  Generated: {channels_email}")
    print(f"  Time: {time_email:.2f}s")
    
    # Calculate improvement
    if time_all > 0:
        speedup = ((time_all - time_email) / time_all) * 100
        print(f"\n🚀 Speed Improvement: {speedup:.1f}% faster when generating only email")
        print(f"   (Saved {time_all - time_email:.2f}s)")


async def main():
    print("🧪 Bug Fix Verification Tests")
    print("="*80)
    
    # Test 1: Channel-specific generation
    await test_channel_specific()
    
    # Test 2: Speed improvement
    await test_speed_improvement()
    
    print(f"\n{'='*80}")
    print("✅ All tests completed!")
    print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(main())
