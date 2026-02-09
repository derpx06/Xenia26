"""
Test SARGE Writer Node - Email, LinkedIn, WhatsApp Generation
"""
import asyncio
from loguru import logger
from ml.application.sarge import run_sarge


async def test_writer():
    """
    Test the new Writer node functionality
    """
    logger.info("🧪 Testing SARGE Writer Node (Email + LinkedIn + WhatsApp)")
    
    test_cases = [
        {
            "name": "Tech CEO - Formal Tone",
            "input": """Generate an email for Sarah Chen, VP of Engineering at DataFlow Inc. 
She recently posted on LinkedIn about scaling distributed systems. 
She's interested in infrastructure automation and has a formal, technical communication style."""
        },
        {
            "name": "Startup Founder - Casual Tone",
            "input": """Create outreach for Mike Johnson, Founder of StartupXYZ. 
He's casual and approachable, loves talking about bootstrapped companies and product-market fit."""
        },
        {
            "name": "Sales Director - Professional",
            "input": """Write messages for Jane Smith, Director of Sales at TechCorp B2B. 
10 years experience in SaaS sales. Professional tone, interested in revenue growth and automation."""
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{'='*80}")
        print(f"Test {i}/{len(test_cases)}: {test['name']}")
        print(f"{'='*80}")
        print(f"Input: {test['input'][:100]}...")
        print()
        
        try:
            result = await run_sarge(test['input'])
            
            print(f"✅ Route: {result.get('router_decision')}")
            
            # Check if prospect was extracted
            prospect = result.get('prospect_data', {})
            if prospect:
                print(f"\n👤 PROSPECT PROFILE:")
                print(f"   Name: {prospect.get('name')}")
                print(f"   Role: {prospect.get('role')}")
                print(f"   Company: {prospect.get('company')}")
                print(f"   Tone: {prospect.get('detected_tone')}")
                print(f"   Interests: {', '.join(prospect.get('key_interests', []))}")
            
            #Check generated content
            content = result.get('generated_content', {})
            if content:
                print(f"\n📧 GENERATED CONTENT:")
                
                if 'email' in content:
                    print(f"\n--- EMAIL ---")
                    print(content['email'][:300] + "..." if len(content['email']) > 300 else content['email'])
                
                if 'linkedin' in content:
                    print(f"\n--- LINKEDIN DM ---")
                    print(content['linkedin'])
                
                if 'whatsapp' in content:
                    print(f"\n--- WHATSAPP ---")
                    print(content['whatsapp'])
            else:
                print("❌ No content generated!")
                print(f"Result: {result}")
                
        except Exception as e:
            print(f"❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*80}")
    print("✅ Writer Node Test Complete")
    print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(test_writer())
