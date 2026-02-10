"""
SARGE Rigorous Hyperpersonalization Verification
Testing: Strategist + Writer + Critic + Self-Correction Loop
"""
import asyncio
from loguru import logger
from ml.application.sarge import run_sarge


async def test_rigorous_hp():
    logger.info("🧪 Starting SARGE Rigorous Hyperpersonalization Test")
    
    test_cases = [
        {
            "name": "Alex Rivera - KubeCon Hook",
            "input": """Generate outreach for Alex Rivera, Head of Platform Reliability at CloudScale. 
He recently spoke at KubeCon about 'Zero-Trust Infrastructure in Multi-Cloud Environments'. 
He hates generic sales fluff. Mention KubeCon in the hook."""
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"CASE: {test['name']}")
        print(f"INPUT: {test['input'][:100]}...")
        print(f"{'='*80}")
        
        try:
            # We run the full graph which now includes loops
            result = await run_sarge(test['input'])
            
            # Verify attempts
            attempts = result.get('generation_attempts', 1)
            print(f"\n📊 TOTAL ATTEMPTS: {attempts}")
            
            # Verify Strategy Brief
            strategy = result.get('strategy_brief', {})
            print(f"\n🧠 FINAL STRATEGY:")
            print(f"   Hook: {strategy.get('hook')}")
            print(f"   Tone: {strategy.get('recommended_tone')}")
            
            # Verify Generated Email
            content = result.get('generated_content', {})
            email = content.get('email', '')
            print(f"\n📧 FINAL HYPERPERSONALIZED EMAIL:")
            print("-" * 40)
            print(email)
            print("-" * 40)
            
            # Verify Critic Feedback
            feedback = result.get('critic_feedback', {})
            print(f"\n⚖️ FINAL CRITIC EVALUATION:")
            print(f"   Score: {feedback.get('score')}/10")
            print(f"   Critique: {feedback.get('critique')}")
            if feedback.get('additions'):
                print(f"   Additions identified: {feedback.get('additions')}")
            if feedback.get('removals'):
                print(f"   Removals identified: {feedback.get('removals')}")

        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_rigorous_hp())
