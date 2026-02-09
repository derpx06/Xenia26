"""
SARGE Hyperpersonalization Verification
Testing: Strategist + Advanced Writer + Critic
"""
import asyncio
from loguru import logger
from ml.application.sarge import run_sarge


async def test_hyperpersonalization():
    logger.info("🧪 Starting SARGE Hyperpersonalization Test")
    
    test_cases = [
        {
            "name": "Niche Tech Lead - Hyperpersonalization",
            "input": """Generate outreach for Alex Rivera, Head of Platform Reliability at CloudScale. 
He recently spoke at KubeCon about 'Zero-Trust Infrastructure in Multi-Cloud Environments'. 
He's very technical, hates generic sales fluff, and values precision. 
I want an email that mentions his KubeCon talk specifically as the hook."""
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"CASE: {test['name']}")
        print(f"INPUT: {test['input'][:100]}...")
        print(f"{'='*80}")
        
        try:
            result = await run_sarge(test['input'])
            
            # Verify Strategy Brief
            strategy = result.get('strategy_brief', {})
            print(f"\n🧠 STRATEGY BRIEF:")
            print(f"   Hook: {strategy.get('hook')}")
            print(f"   Target Pain: {strategy.get('pain_point')}")
            
            # Verify Generated Email
            content = result.get('generated_content', {})
            email = content.get('email', '')
            print(f"\n📧 HYPERPERSONALIZED EMAIL:")
            print("-" * 40)
            print(email)
            print("-" * 40)
            
            # Verify Critic Feedback
            feedback = result.get('critic_feedback', 'No feedback')
            print(f"\n⚖️ CRITIC EVALUATION:")
            print(feedback)
            
            # Check if KubeCon was mentioned in the email
            if "KubeCon" in email:
                print("\n✅ HYPERPERSONALIZATION: 'KubeCon' mentioned in final email!")
            else:
                print("\n❌ HYPERPERSONALIZATION: 'KubeCon' MISSING from email!")

        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_hyperpersonalization())
