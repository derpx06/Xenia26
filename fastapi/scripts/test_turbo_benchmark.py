import asyncio
import time
from loguru import logger
from ml.application.sarge import run_sarge

async def benchmark_turbo():
    print("\n🚀 SARGE TURBO BENCHMARK")
    print("="*40)
    
    test_cases = [
        {
            "name": "Heuristic Bypass (Generate)",
            "input": "Draft an email to Satya Nadella at Microsoft about AI safety."
        },
        {
            "name": "Full Profile + Generation",
            "input": "Generate outreach for Jensen Huang at NVIDIA. Mention recent GPU news. Formal tone."
        }
    ]
    
    for test in test_cases:
        print(f"\nTEST: {test['name']}")
        print(f"INPUT: {test['input']}")
        
        start_time = time.time()
        result = await run_sarge(test['input'])
        end_time = time.time()
        
        duration = end_time - start_time
        decision = result.get("router_decision")
        
        print(f"⏱️  Duration: {duration:.2f}s")
        print(f"🔀 Decision: {decision}")
        
        if duration < 60:
            print("✅ SPEED: PASS (< 60s)")
        else:
            print("❌ SPEED: FAIL (> 60s)")
            
        # Check for expected content
        gen_content = result.get("generated_content", {})
        if "email" in gen_content:
             print("📄 Email Generated")
        if "linkedin" in gen_content:
             print("📄 LinkedIn Generated")

if __name__ == "__main__":
    asyncio.run(benchmark_turbo())
