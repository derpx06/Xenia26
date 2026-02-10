"""
SARGE Final Targeted Verification Suite
Coverage: Simple -> Complex (Profile + Multi-channel) -> Refinement -> Fallback
"""
import asyncio
from loguru import logger
from ml.application.sarge import run_sarge


async def run_targeted_tests():
    logger.info("🧪 Starting SARGE Final Verification (A-Z)")
    
    test_cases = [
        {
            "category": "1. SIMPLE GREETING (Tier 1)",
            "input": "Hi there! Who are you and how can you help me?",
            "check": lambda r: r.get("router_decision") == "direct"
        },
        {
            "category": "2. COMPLEX GENERATION - TECH CEO (Tier 2, Formal)",
            "input": """Generate outreach for Sarah Chen, VP of Engineering at DataFlow Inc. 
Focus on their recent post about scaling distributed systems. 
Use a formal, technical tone. I need an email, LinkedIn DM, and WhatsApp message.""",
            "check": lambda r: all(k in r.get("generated_content", {}) for k in ["email", "linkedin", "whatsapp"]) and r.get("prospect_data", {}).get("detected_tone") == "technical"
        },
        {
            "category": "3. COMPLEX GENERATION - STARTUP FOUNDER (Tier 2, Casual)",
            "input": """Create outreach for Mike Johnson, Founder of StartupXYZ. 
He loves bootstrapped companies and product-market fit. 
Keep it very casual and friendly. Give me all 3 channels.""",
            "check": lambda r: r.get("prospect_data", {}).get("detected_tone") == "casual"
        },
        {
            "category": "4. REFINEMENT (Tier 2, Editor)",
            "input": "That email for Sarah is too long. Make it much shorter and more direct.",
            "check": lambda r: "edited_content" in r.get("generated_content", {})
        },
        {
            "category": "5. FALLBACK (Tier 2, Fallback)",
            "input": "What's the best pizza place in San Francisco?",
            "check": lambda r: "fallback_message" in r.get("generated_content", {})
        }
    ]
    
    results = []
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"RUNNING: {test['category']}")
        print(f"INPUT: {test['input']}")
        print(f"{'='*80}")
        
        try:
            result = await run_sarge(test['input'])
            passed = test['check'](result)
            status = "✅ PASS" if passed else "❌ FAIL"
            results.append((test['category'], status))
            
            print(f"STATUS: {status}")
            print(f"ROUTE: {result.get('router_decision')}")
            
            p_data = result.get('prospect_data')
            if p_data:
                 print(f"PROSPECT: {p_data.get('name')} | {p_data.get('detected_tone')}")
            
            g_content = result.get('generated_content', {})
            for key, val in g_content.items():
                snippet = str(val)[:150].replace('\n', ' ')
                print(f"[{key}]: {snippet}...")
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
            results.append((test['category'], "❌ ERROR"))
            
    print(f"\n{'='*80}")
    print("FINAL SUMMARY")
    print(f"{'='*80}")
    for cat, stat in results:
        print(f"{cat:<50} {stat}")
    print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(run_targeted_tests())
