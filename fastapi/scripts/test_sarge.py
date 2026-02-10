"""
SARGE Test Script
Tests all routing paths and latency requirements
"""
import asyncio
import time
from loguru import logger
from ml.application.sarge import run_sarge


async def test_sarge():
    """
    Test all SARGE routing scenarios
    """
    logger.info("🧪 Starting SARGE Tests...")
    
    test_cases = [
        {
            "name": "Test 1: Simple Greeting (Direct Response)",
            "input": "Hello there!",
            "expected_route": "direct",  # Should bypass graph
            "description": "Simple conversational query should get direct LLM response"
        },
        {
            "name": "Test 2: Simple Question (Direct Response)",
            "input": "What can you do?",
            "expected_route": "direct",
            "description": "Short, simple question should get direct response"
        },
        {
            "name": "Test 3: Generate Request (Router → Profiler)",
            "input": "Generate an email for John Doe, CEO at TechCorp. He's interested in AI automation.",
            "expected_route": "generate",
            "description": "Complex generation task should use graph routing"
        },
        {
            "name": "Test 4: Refine Request (Router → Editor)",
            "input": "Make it shorter and more casual",
            "expected_route": "refine",
            "description": "Refinement request should route to editor"
        },
        {
            "name": "Test 5: Gibberish (Router → Fallback)",
            "input": "asdfghjkl",
            "expected_route": "unknown",
            "description": "Gibberish should trigger fallback"
        },
        {
            "name": "Test 6: Out of Scope (Router → Fallback)",
            "input": "What's the weather today?",
            "expected_route": "unknown",
            "description": "Out-of-scope query should trigger fallback"
        }
    ]
    
    results = []
    
    for test in test_cases:
        print(f"\n{'='*70}")
        print(f"{test['name']}")
        print(f"Input: \"{test['input']}\"")
        print(f"Expected Route: {test['expected_route']}")
        print(f"Description: {test['description']}")
        print(f"{'='*70}")
        
        start_time = time.time()
        
        try:
            result = await run_sarge(test['input'])
            
            elapsed = time.time() - start_time
            
            # Check routing correctness
            actual_route = result.get('router_decision', 'unknown')
            route_correct = actual_route == test['expected_route']
            
            print(f"✅ Completed in {elapsed:.2f}s")
            print(f"   Actual Route: {actual_route}")
            print(f"   Routing: {'✅ CORRECT' if route_correct else '❌ INCORRECT (expected: ' + test['expected_route'] + ')'}")
            
            # Print generated content
            content = result.get('generated_content', {})
            if content:
                print(f"\n   Generated Content:")
                for key, value in content.items():
                    value_str = str(value)
                    print(f"   - {key}: {value_str[:100]}..." if len(value_str) > 100 else f"   - {key}: {value_str}")
            
            results.append({
                "test": test['name'],
                "passed": route_correct,
                "latency": elapsed,
                "route": actual_route,
                "expected": test['expected_route']
            })
            
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"❌ Failed after {elapsed:.2f}s: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                "test": test['name'],
                "passed": False,
                "latency": elapsed,
                "error": str(e)
            })
    
    # Summary
    print(f"\n\n{'='*70}")
    print("📊 SMART ROUTING TEST SUMMARY")
    print(f"{'='*70}")
    
    passed = sum(1 for r in results if r['passed'])
    total = len(results)
    avg_latency = sum(r['latency'] for r in results if 'latency' in r) / len(results)
    
    print(f"Routing Accuracy: {passed}/{total} ({(passed/total)*100:.1f}%)")
    print(f"Average Latency: {avg_latency:.2f}s")
    
    print(f"\n{'Test':<45} {'Route':<15} {'Status':<12} {'Time'}")
    print(f"{'-'*70}")
    for r in results:
        status = "✅ CORRECT" if r['passed'] else "❌ WRONG"
        route_info = f"{r.get('route', 'N/A')}"
        if not r['passed'] and 'expected' in r:
            route_info += f" (≠{r['expected']})"
        print(f"{r['test']:<45} {route_info:<15} {status:<12} {r['latency']:.2f}s")


if __name__ == "__main__":
    asyncio.run(test_sarge())
