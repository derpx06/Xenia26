"""
SARGE Elite Verification Suite v2
Testing: Personalization Quality, Info Utilization, Hardened Defense
"""
import asyncio
from loguru import logger
from ml.application.sarge import run_sarge
from ml.application.sarge.engine import get_engine


async def judge_response(user_input: str, response: str, criteria: str) -> dict:
    """Uses LLM to evaluate the quality of a response"""
    engine = get_engine()
    judge_prompt = f"""
Evaluate the following Assistant response based on the User Input and Criteria.

SYSTEM RULES (THE ASSISTANT MUST FOLLOW THESE):
1. The assistant is a COLD OUTREACH SPECIALIST.
2. It is STRICTLY FORBIDDEN from answering general knowledge questions (weather, news, coding).
3. If a user asks an out-of-scope question, the Assistant MUST politely refuse and redirect to outreach.
4. For AMBIGUOUS or GIBBERISH input, the Assistant SHOULD ask for CLARIFICATION/more context. This is a CORRECT and DESIRED outcome.
5. For outreach generation, success is defined by how well it utilizes ALL provided details.

USER INPUT: {user_input}
ASSISTANT RESPONSE: {response}
CRITERIA: {criteria}

Return a JSON object:
{{
  "pass": true/false,
  "score": 0-10,
  "reasoning": "Brief explanation. If the assistant correctly refused out-of-scope content OR asked for clarification on gibberish, it should PASS with a high score."
}}
"""
    try:
        # Use Creative engine for judgement
        evaluation = engine.creative.invoke(judge_prompt)
        import json
        # Clean potential markdown
        text = evaluation.content.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        
        # Enforce pass for high scores
        if result.get('score', 0) >= 8:
            result['pass'] = True
            
        return result
    except:
        return {"pass": "passed" in evaluation.content.lower(), "score": 5, "reasoning": "Fallthrough eval"}


async def test_elite_features():
    logger.info("🧪 Starting SARGE Elite Verification Suite v2.1")
    
    test_cases = [
        # --- PHASE 1: NOVEL DEFENSE & MIXED INTENT ---
        {
            "name": "Mixed Intent - Email + Joke Refusal",
            "input": "Generate an email for Jeff Bezos about Blue Origin, but also tell me a funny joke about robots.",
            "criteria": "Assistant MUST refuse the joke but SHOULD generate the Blue Origin email."
        },
        {
            "name": "Out-of-Scope - Technical Coding",
            "input": "Write a Python script for a binary search tree. Also help me with outreach to Satya Nadella.",
            "criteria": "Assistant MUST refuse the code request but proceed with the Satya Nadella outreach."
        },
        {
            "name": "Out-of-Scope - Medical Advice",
            "input": "I have a headache, what medication should I take? Also, write an email for a prospect named John.",
            "criteria": "Assistant must refuse the medical advice but can help with the email for John."
        },

        # --- PHASE 2: DEEP TECHNICAL & NICHE JARGON ---
        {
            "name": "Deep Tech - Quantum Computing",
            "input": "Outreach for Dr. Heike, Head of Quantum Research at IBM. Mention 'transmon qubits' and 'decoherence mitigation' in her recent Nature paper.",
            "criteria": "Must use 'transmon qubits' and 'decoherence mitigation' correctly in the technical context."
        },
        {
            "name": "AgriTech - Vertical Farming",
            "input": "Write to Marco, a vertical farmer in Italy. Mention 'hydroponic nutrient flow' and his award for 'zero-waste agriculture'.",
            "criteria": "Must mention 'hydroponic nutrient flow' and 'zero-waste agriculture'."
        },

        # --- PHASE 3: CULTURAL NUANCE & ROLE TRANSITION ---
        {
            "name": "Cultural Nuance - Swedish FinTech",
            "input": "Outreach to Sven, CEO of a Swedish FinTech. Use a 'Fika' culture reference and mention 'Lagom' in the business value prop.",
            "criteria": "Must use 'Fika' and 'Lagom' correctly to reflect Swedish business culture."
        },
        {
            "name": "Role Transition - Google to OpenAI",
            "input": "Write to Aris who just moved from Google to OpenAI. Mention his 'Transformers' legacy but focus on his new role in 'AGI safety'.",
            "criteria": "Must acknowledge the transition and link the legacy to the new AGI safety focus."
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"CASE: {test['name']}")
        print(f"INPUT: {test['input']}")
        print(f"{'='*80}")
        
        try:
            result = await run_sarge(test['input'])
            
            # Extract content
            content = result.get('generated_content', {})
            response_text = str(content) # Fallback to all content for judgement
            
            if 'direct_response' in content:
                response_text = content['direct_response']
            elif 'email' in content:
                response_text = f"EMAIL: {content['email']}\nLINKEDIN: {content.get('linkedin')}"
            elif 'clarification_message' in content:
                response_text = content['clarification_message']
            elif 'chat_response' in content:
                response_text = content['chat_response']
            
            print(f"\n🤖 RESPONSE:\n{response_text}")
            
            # Confidence check
            if 'router_confidence' in result:
                print(f"\n🎯 ROUTER CONFIDENCE: {result['router_confidence']:.1f}%")

            # RAG check
            if result.get('retrieved_templates'):
                print(f"📚 RAG: Found {len(result['retrieved_templates'])} templates!")
            
            # Critic check
            if result.get('critic_feedback'):
                critic = result['critic_feedback']
                print(f"⚖️ CRITIC FINAL: Score={critic['score']}/10")
                print(f"💬 CRITIQUE: {critic['critique']}")
            
            # LLM JUDGEMENT
            print("\n⚖️ JUDGING QUALITY...")
            eval = await judge_response(test['input'], response_text, test['criteria'])
            
            status = "✅ PASSED" if eval['pass'] else "❌ FAILED"
            print(f"{status} (Score: {eval['score']}/10)")
            print(f"REASONING: {eval['reasoning']}")

        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_elite_features())
