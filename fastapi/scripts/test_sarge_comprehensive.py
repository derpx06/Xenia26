"""
Comprehensive SARGE Test Suite
Tests every feature from simple to complex
"""
import asyncio
import time
from loguru import logger
from ml.application.sarge import run_sarge


async def test_comprehensive():
    """
    Comprehensive test suite covering all SARGE capabilities
    """
    logger.info("🧪 Starting Comprehensive SARGE Test Suite...")
    
    test_categories = {
        "SIMPLE_CONVERSATIONAL": [
            {
                "name": "Greeting",
                "input": "Hello!",
                "expected_features": ["direct_response", "friendly"]
            },
            {
                "name": "Capabilities Question",
                "input": "What can you help me with?",
                "expected_features": ["direct_response", "cold outreach"]
            },
            {
                "name": "Thanks",
                "input": "Thank you!",
                "expected_features": ["direct_response"]
            }
        ],
        
        "MEDIUM_COMPLEXITY": [
            {
                "name": "Specific Prospect Question",
                "input": "How do I write an email to a CEO?",
                "expected_features": ["guidance", "helpful"]
            },
            {
                "name": "Platform Question",
                "input": "Should I use LinkedIn or email?",
                "expected_features": ["advice", "recommendation"]
            }
        ],
        
        "COMPLEX_GENERATION": [
            {
                "name": "Email with Full Details",
                "input": """Generate an email for Sarah Chen, VP of Engineering at DataFlow Inc. 
She recently posted on LinkedIn about scaling distributed systems. 
She's interested in infrastructure automation and has a formal, technical communication style.""",
                "expected_features": ["prospect_data", "email", "linkedin", "whatsapp"],
                "validate": lambda r: all(k in r.get("generated_content", {}) for k in ["email", "linkedin", "whatsapp"])
            },
            {
                "name": "Email with URL",
                "input": "Create an outreach email for the person at linkedin.com/in/john-doe who works in AI research",
                "expected_features": ["generate", "email", "linkedin", "whatsapp"],
                "validate": lambda r: r.get("router_decision") == "generate" and "email" in r.get("generated_content", {})
            },
            {
                "name": "Multi-Channel Request",
                "input": """Write both an email and LinkedIn message for Mike Johnson, 
Founder of StartupXYZ. He's casual and approachable, loves talking about bootstrapped companies.""",
                "expected_features": ["prospect_data", "email", "linkedin", "whatsapp"],
                "validate": lambda r: "casual" in str(r.get("prospect_data", {})).lower()
            }
        ],
        
        "REFINEMENT_WORKFLOWS": [
            {
                "name": "Make Shorter",
                "input": "Make it shorter",
                "expected_features": ["refine", "editor"],
                "validate": lambda r: r.get("router_decision") == "refine"
            },
            {
                "name": "Change Tone",
                "input": "Make it more casual and friendly",
                "expected_features": ["refine"],
                "validate": lambda r: r.get("router_decision") == "refine"
            },
            {
                "name": "Add Specific Element",
                "input": "Add a mention of their recent blog post",
                "expected_features": ["refine", "editor"]
            }
        ],
        
        "EDGE_CASES": [
            {
                "name": "Very Short Input",
                "input": "hi",
                "expected_features": ["direct"]
            },
            {
                "name": "Very Long Input",
                "input": """I need you to help me create a comprehensive outreach strategy for a prospect 
who is the Chief Technology Officer at a Fortune 500 company. They have extensive experience 
in cloud infrastructure, have spoken at multiple conferences about DevOps, and recently 
published a whitepaper on Kubernetes scaling. I want to reach out about our new platform 
that helps automate infrastructure deployments. Can you write me a professional email that 
mentions their whitepaper, references their conference talk from last month, and introduces 
our solution in a way that shows I've done my research?""",
                "expected_features": ["generate", "prospect_data"]
            },
            {
                "name": "Mixed Casing and Punctuation",
                "input": "HeLLo ThErE!!! CaN yOu HeLp Me???",
                "expected_features": ["direct_response"]
            },
            {
                "name": "Empty-ish Query",
                "input": "...",
                "expected_features": ["fallback", "unknown"]
            }
        ],
        
        "REAL_WORLD_SCENARIOS": [
            {
                "name": "LinkedIn Profile Analysis",
                "input": "Analyze this prospect: Jane Smith, Director of Sales at TechCorp, 10 years experience, interested in B2B SaaS",
                "expected_features": ["prospect_data", "generate"]
            },
            {
                "name": "Conference Attendee Outreach",
                "input": """I met Alex Rodriguez at the AI Summit. He's a Machine Learning Engineer at OpenAI, 
seemed interested in our data labeling platform. Write a follow-up email.""",
                "expected_features": ["prospect_data", "generate"]
            },
            {
                "name": "Warm Introduction",
                "input": """Create an introduction message for Lisa Park, who was referred by our mutual connection. 
She's looking for marketing automation tools. Keep it warm and reference the referral.""",
                "expected_features": ["generate", "prospect_data"]
            }
        ]
    }
    
    all_results = {}
    total_tests = 0
    passed_tests = 0
    
    for category, tests in test_categories.items():
        print(f"\n{'='*80}")
        print(f"📂 CATEGORY: {category.replace('_', ' ')}")
        print(f"{'='*80}")
        
        category_results = []
        
        for test in tests:
            total_tests += 1
            print(f"\n{'─'*80}")
            print(f"🧪 Test: {test['name']}")
            print(f"📝 Input: \"{test['input'][:100]}{'...' if len(test['input']) > 100 else ''}\"")
            print(f"{'─'*80}")
            
            start_time = time.time()
            
            try:
                result = await run_sarge(test['input'])
                elapsed = time.time() - start_time
                
                # Check expected features
                features_found = []
                features_missing = []
                
                result_str = str(result).lower()
                for feature in test.get('expected_features', []):
                    if feature.lower() in result_str:
                        features_found.append(feature)
                    else:
                        features_missing.append(feature)
                
                # Custom validation if provided
                custom_valid = True
                if 'validate' in test:
                    try:
                        custom_valid = test['validate'](result)
                    except Exception as e:
                        custom_valid = False
                        logger.warning(f"Validation failed: {e}")
                
                # Determine pass/fail
                basic_pass = len(features_missing) == 0
                overall_pass = basic_pass and custom_valid
                
                if overall_pass:
                    passed_tests += 1
                
                # Print results
                print(f"⏱️  Completed in {elapsed:.2f}s")
                print(f"🎯 Route: {result.get('router_decision', 'N/A')}")
                
                if features_found:
                    print(f"✅ Features Found: {', '.join(features_found)}")
                if features_missing:
                    print(f"❌ Features Missing: {', '.join(features_missing)}")
                
                # Print key outputs
                if 'prospect_data' in result and result['prospect_data']:
                    pd = result['prospect_data']
                    print(f"👤 Prospect: {pd.get('name', 'N/A')} - {pd.get('role', 'N/A')} at {pd.get('company', 'N/A')}")
                
                content = result.get('generated_content', {})
                if content:
                    for key, value in list(content.items())[:2]:  # Show first 2 outputs
                        value_str = str(value)
                        print(f"📄 {key}: {value_str[:120]}{'...' if len(value_str) > 120 else ''}")
                
                print(f"{'✅ PASSED' if overall_pass else '❌ FAILED'}")
                
                category_results.append({
                    "name": test['name'],
                    "passed": overall_pass,
                    "latency": elapsed,
                    "route": result.get('router_decision', 'N/A'),
                    "features_found": len(features_found),
                    "features_expected": len(test.get('expected_features', []))
                })
                
            except Exception as e:
                elapsed = time.time() - start_time
                print(f"❌ FAILED after {elapsed:.2f}s")
                print(f"Error: {str(e)}")
                
                import traceback
                traceback.print_exc()
                
                category_results.append({
                    "name": test['name'],
                    "passed": False,
                    "latency": elapsed,
                    "error": str(e)
                })
        
        all_results[category] = category_results
    
    # Final Summary
    print(f"\n\n{'='*80}")
    print("📊 COMPREHENSIVE TEST SUMMARY")
    print(f"{'='*80}")
    
    print(f"\n🎯 Overall Results: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    for category, results in all_results.items():
        cat_passed = sum(1 for r in results if r['passed'])
        cat_total = len(results)
        avg_latency = sum(r['latency'] for r in results) / len(results) if results else 0
        
        print(f"\n📂 {category.replace('_', ' ')}: {cat_passed}/{cat_total} passed (avg latency: {avg_latency:.2f}s)")
        
        for r in results:
            status = "✅" if r['passed'] else "❌"
            print(f"   {status} {r['name']:<40} ({r['latency']:.2f}s)")
    
    print(f"\n{'='*80}")
    
    return all_results


if __name__ == "__main__":
    asyncio.run(test_comprehensive())
