"""
SARGE Nodes - Chat, Profiler, Strategist, Writer, Critic, Editor, and Fallback
"""
from langsmith import traceable
from loguru import logger
from .schemas import AgentState, ProspectProfile, StrategyBrief, CriticFeedback
from .engine import get_engine
from ..agent.knowledge import SimpleKnowledgeBase
import instructor
import openai
import asyncio
from typing import Optional, List


@traceable(name="SARGE Chat Node")
def chat_node(state: AgentState) -> AgentState:
    """
    Fast conversational responses
    Preset C: Temperature 0.7, Text output
    Target: <1s latency
    """
    logger.info("💬 CHAT: Generating friendly response")
    
    engine = get_engine()
    
    # Build conversation context
    history = state.get("conversation_history", [])
    context = "\n".join(history[-3:]) if history else ""
    
    prompt = f"""You are a helpful Cold Outreach Assistant.

You DO NOT answer general questions like weather, news, or coding. If a user asks these, politely reply that you only help with cold outreach and direct them to provide a prospect for analysis.

Previous conversation:
{context if context else "No previous conversation"}

User: {state['raw_input']}

Respond briefly and helpfully in the context of cold outreach ONLY."""
    
    try:
        response = engine.creative.invoke(prompt)
        
        # Update conversation history
        new_history = history + [
            f"User: {state['raw_input']}",
            f"Assistant: {response.content}"
        ]
        
        logger.info(f"💬 CHAT: Response generated ({len(response.content)} chars)")
        
        return {
            "conversation_history": new_history[-10:],  # Keep last 10 messages
            "generated_content": {"chat_response": response.content}
        }
    except Exception as e:
        logger.error(f"💬 CHAT: Failed - {e}")
        return {
            "generated_content": {"chat_response": "I'm here to help! What would you like to do?"}
        }


@traceable(name="SARGE Profiler Node")
def profiler_node(state: AgentState) -> AgentState:
    """
    Extract structured prospect data
    Preset B: Temperature 0.1, JSON output
    """
    logger.info("🔍 PROFILER: Extracting prospect data")
    
    engine = get_engine()
    
    # Setup structured output
    llm_client = instructor.from_openai(
        openai.OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        ),
        mode=instructor.Mode.JSON
    )
    
    extraction_prompt = f"""You are a data extraction specialist. Extract prospect information from this text.

INPUT TEXT:
{state['raw_input']}

EXTRACTION RULES:
1. name: Extract the person's full name. If no name is found, return "Unknown"
2. role: Extract job title/position. Return null if not found.
3. industry: Identify the industry/sector. Return null if not found.
4. company: Extract company name. Return null if not found.
5. detected_tone: Analyze communication style:
   - "casual" if text mentions: friendly, approachable, casual, relaxed, laid-back
   - "technical" if text mentions: technical, engineering, systems, infrastructure, technical details
   - "formal" if text mentions: professional, formal, executive, C-level, director
   - Default to "formal" if unclear
6. key_interests: List topics mentioned (e.g., ["AI", "automation", "growth"])

Return valid JSON with these exact fields. Use null for missing optional fields, never leave fields undefined."""
    
    try:
        profile: ProspectProfile = llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=ProspectProfile,
            messages=[
                {"role": "system", "content": "You are a data extraction specialist. Always return valid JSON matching the schema. Use null for missing data, never undefined."},
                {"role": "user", "content": extraction_prompt}
            ],
            temperature=0.1,
            max_retries=3
        )
        
        profile_dict = profile.model_dump()
        
        # Safety defaults if LLM returned nulls
        if not profile_dict.get("name"): 
            profile_dict["name"] = "Unknown Prospect"
        if not profile_dict.get("detected_tone"):
            profile_dict["detected_tone"] = "formal"
            
        logger.info(f"🔍 PROFILER: Extracted profile for {profile_dict['name']}")
        
        return {
            "prospect_data": profile_dict,
            "generation_attempts": 0 # Initialize attempts
        }
        
    except Exception as e:
        logger.error(f"🔍 PROFILER: Extraction failed - {e}")
        return {
            "prospect_data": {
                "name": "Unknown Prospect",
                "role": None,
                "industry": None,
                "company": None,
                "detected_tone": "formal",
                "key_interests": []
            },
            "generation_attempts": 0
        }


@traceable(name="SARGE Strategist Node")
def strategist_node(state: AgentState) -> AgentState:
    """
    Brainstorm hyperpersonalized outreach strategy
    Preset B: Temperature 0.1, JSON output
    """
    logger.info("🧠 STRATEGIST: Brainstorming hyperpersonalized strategy")
    
    engine = get_engine()
    prospect = state.get("prospect_data", {})
    
    if not prospect or prospect.get("name") == "Unknown Prospect":
        logger.warning("🧠 STRATEGIST: Insufficient prospect data for deep strategy")
        return {
            "strategy_brief": {
                "hook": "Generic professional outreach greeting",
                "value_prop": "Generic outreach assistance",
                "pain_point": "Manual outreach overhead",
                "recommended_tone": "formal"
            }
        }

    # Setup structured output
    llm_client = instructor.from_openai(
        openai.OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        ),
        mode=instructor.Mode.JSON
    )

    strategy_prompt = f"""You are a top-tier Sales Strategist. Design a hyperpersonalized outreach strategy.

PROSPECT DATA:
- Name: {prospect.get('name')}
- Role: {prospect.get('role')}
- Company: {prospect.get('company')}
- Interests: {', '.join(prospect.get('key_interests', []))}
- Industry: {prospect.get('industry')}

GOAL: Find a unique "Hook" and "Value Prop" that will resonate deeply.
Think: Why should they care RIGHT NOW? What specific detail in their profile can we use?

Required Output:
1. hook: A specific, high-intent opener.
2. value_prop: How we solve a problem specific to their role/interests.
3. pain_point: A likely challenge they face in their current position.
4. recommended_tone: Nuanced tone suggestion (e.g. "approachable but technical")."""

    try:
        strategy: StrategyBrief = llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=StrategyBrief,
            messages=[
                {"role": "system", "content": "You are a Sales Strategy expert. Brainstorm unique, non-generic outreach angles."},
                {"role": "user", "content": strategy_prompt}
            ],
            temperature=0.1
        )
        
        logger.info(f"🧠 STRATEGIST: Strategy generated with hook: '{strategy.hook[:50]}...'")
        
        return {
            "strategy_brief": strategy.model_dump()
        }
    except Exception as e:
        logger.error(f"🧠 STRATEGIST: Strategy brainstorming failed - {e}")
        return {
            "strategy_brief": {
                "hook": f"Reaching out to {prospect.get('name')} regarding {prospect.get('company')}",
                "value_prop": "General outreach value",
                "pain_point": "Inefficient outreach",
                "recommended_tone": "formal"
            }
        }


@traceable(name="SARGE Retriever Node")
def retriever_node(state: AgentState) -> AgentState:
    """
    Query ChromaDB for successful past outreach templates
    """
    logger.info("📚 RETRIEVER: Querying past successful templates")
    
    prospect = state.get("prospect_data", {})
    industry = prospect.get("industry", "Unknown")
    role = prospect.get("role", "Unknown")
    
    kb = SimpleKnowledgeBase()
    
    # Query for similar outreach based on role and industry
    query = f"Outreach for {role} in {industry}"
    past_examples = kb.get_similar_outreach(query, limit=3)
    
    templates = [ex['content'] for ex in past_examples]
    
    if not templates:
        logger.info("📚 RETRIEVER: No past examples found, starting fresh")
    else:
        logger.info(f"📚 RETRIEVER: Found {len(templates)} relevant templates")
        
    return {
        "retrieved_templates": templates
    }


@traceable(name="SARGE Writer Node")
async def writer_node(state: AgentState) -> AgentState:
    """
    Generate personalized Email, LinkedIn DM, and WhatsApp messages
    Preset C: Temperature 0.7, Creative output
    Parallelized with asyncio.gather
    """
    logger.info(f"✍️ WRITER: Generating content (Attempt {state.get('generation_attempts', 0) + 1})")
    
    engine = get_engine()
    prospect = state.get("prospect_data", {})
    strategy = state.get("strategy_brief", {})
    critic = state.get("critic_feedback", {})
    templates = state.get("retrieved_templates", [])
    
    if not prospect or prospect.get("name") == "Unknown Prospect":
        logger.warning("✍️ WRITER: No prospect data available")
        return {
            "generated_content": {
                "error": "No prospect profile found. Please provide prospect details first."
            }
        }
    
    name = prospect.get("name", "there")
    role = prospect.get("role", "your role")
    company = prospect.get("company", "your company")
    tone = strategy.get("recommended_tone", prospect.get("detected_tone", "formal"))
    
    # DYNAMIC FEW-SHOT EXAMPLES based on tone
    few_shot_examples = ""
    if "casual" in tone.lower():
        few_shot_examples = """
CASUAL OUTREACH EXAMPLES (FEW-SHOT):
1. "Hey [Name], saw your post about [Topic]—super cool! I'm [My Name], working on [Project]. Coffee next week?"
2. "Hi [Name]! Love what [Company] is doing. Ever thought about [Problem]? We're fixing that. Cheers!"
"""
    elif "formal" in tone.lower() or "professional" in tone.lower():
        few_shot_examples = """
FORMAL OUTREACH EXAMPLES (FEW-SHOT):
1. "Dear [Name], I recently followed your work at [Company] regarding [Topic]. I am writing to discuss a potential collaboration..."
2. "Hello [Name], I hope this email finds you well. As the [Role] at [Company], I thought you might be interested in our new solution for [Problem]."
"""

    past_context = ""
    if templates:
        past_context = "\nSUCCESSFUL PAST TEMPLATES FOR REFERENCE:\n" + "\n---\n".join(templates)

    # Check for critic feedback to incorporate
    critic_notes = ""
    if critic and critic.get("score", 10) < 8:
        critic_notes = f"""
!!! CRITIC FEEDBACK FROM PREVIOUS ATTEMPT (MUST FIX) !!!
- Overall Critique: {critic.get('critique')}
- Specific Additions: {', '.join(critic.get('additions', []))}
- Specific Removals: {', '.join(critic.get('removals', []))}

INSTRUCTION: Your previous draft was REJECTED for being too generic. 
You MUST REWRITE the sections mentioned above. Do NOT reuse the same rejected boilerplate.
"""

    # Prepare prompts
    email_prompt = f"""Write a HYPERPERSONALIZED cold outreach EMAIL.
{few_shot_examples}
{past_context}
{critic_notes}
STRATEGY: {strategy.get('hook')} | {strategy.get('value_prop')}
PROSPECT: {name}, {role} at {company} (Tone: {tone})
Requirements: Subject included, 120-180 words, must start with Hook."""

    linkedin_prompt = f"""Write a HYPERPERSONALIZED LINKEDIN DM.
{few_shot_examples}
PROSPECT: {name} ({role}) | Tone: {tone}
Under 400 characters. Mention connection point clearly and propose value."""

    whatsapp_prompt = f"""Write a 3-4 sentence HYPERPERSONALIZED WHATSAPP message.
Target: {name} | Hook: {strategy.get('hook')}"""

    # Parallel execution
    tasks = [
        engine.creative.ainvoke(email_prompt),
        engine.creative.ainvoke(linkedin_prompt),
        engine.creative.ainvoke(whatsapp_prompt)
    ]
    
    results = await asyncio.gather(*tasks)
    contents = {
        "email": results[0].content,
        "linkedin": results[1].content,
        "whatsapp": results[2].content
    }

    return {
        "generated_content": contents,
        "generation_attempts": state.get("generation_attempts", 0) + 1
    }


@traceable(name="SARGE Critic Node")
def critic_node(state: AgentState) -> AgentState:
    """
    Evaluate content quality and personalization with rigorous rigour
    Preset A: Temperature 0.0, JSON output
    """
    logger.info("⚖️ CRITIC: Evaluating content quality (Rigorous)")
    
    engine = get_engine()
    content = state.get("generated_content", {})
    strategy = state.get("strategy_brief", {})
    attempts = state.get("generation_attempts", 0)
    
    if "error" in content:
        return {"critic_feedback": {"score": 1, "is_ready": False, "critique": "Generation failed."}}

    # Setup structured output
    llm_client = instructor.from_openai(
        openai.OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        ),
        mode=instructor.Mode.JSON
    )

    evaluation_prompt = f"""You are a senior Quality Assurance Specialist for Personalized Sales Outreach.
Evaluate the latest generation attempt.

STRATEGY INTENDED:
- Hook: {strategy.get('hook')}
- Value Prop: {strategy.get('value_prop')}

CONTENT TO EVALUATE:
EMAIL:
{content.get('email')}

LINKEDIN:
{content.get('linkedin')}

WHATSAPP:
{content.get('whatsapp')}

EVALUATION RULES (BE SPECIFIC - NO GENERIC PHRASES):
1. HOOK FIDELITY (Email): Did it start with the specific hook provided? If not, state exactly what is missing.
2. PERSONALIZATION: Identify EXACT prospect details used. Avoid saying "needs more personalization". Instead, say "Mention [Specific Fact] from [Source]".
3. FEEDBACK ADHERENCE: If there was previous feedback ({attempts} attempts so far), did the writer actually fix the reported issues? Identify specific ignored feedback.
4. CHANNEL OPTIMIZATION: Is the LinkedIn DM 300-400 chars? Is the WhatsApp message 3-4 sentences? If too short/long, specify by how much.

CRITICAL: Your 'critique' MUST be actionable. Instead of "lacks wow factor", say "The hook is too formal; change it to mention the prospect's recent tweet about [Topic]".

SCORING:
- 1-6: Generic/Boilerplate. (is_ready: False)
- 7: Good but needs specific actionable refinements. (is_ready: False)
- 8-9: Excellent. Hyperpersonalized and specific. (is_ready: True)
- 10: Perfect. (is_ready: True)

RETURN JSON with:
- score (int)
- critique (str: ACTIONABLE AND SPECIFIC suggestions only)
- additions (list of strings: specific facts/keywords/phrases to add)
- removals (list of strings: specific phrases/boilerplate to remove)
- is_ready (bool)
"""

    try:
        feedback: CriticFeedback = llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=CriticFeedback,
            messages=[
                {"role": "system", "content": "You are a critical Sales Editor. Identify specific elements to add or remove. Reward improvements between attempts."},
                {"role": "user", "content": evaluation_prompt}
            ],
            temperature=0.0
        )
        
        # Enforce logic: Score 8+ is ALWAYS ready to prevent unnecessary loops (Speed Optimization)
        if feedback.score >= 8:
            feedback.is_ready = True
            
        logger.info(f"⚖️ CRITIC: Score={feedback.score}/10 | Ready={feedback.is_ready} | Attempt={attempts}")
        
        return {
            "critic_feedback": feedback.model_dump()
        }
    except Exception as e:
        logger.error(f"⚖️ CRITIC: Evaluation failed - {e}")
        return {
            "critic_feedback": {
                "score": 7,
                "critique": "Evaluation system error, assuming basic quality.",
                "is_ready": True, # Fail-safe to avoid infinite loop
                "additions": [],
                "removals": []
            }
        }


@traceable(name="SARGE Editor Node")
def editor_node(state: AgentState) -> AgentState:
    """
    Refine existing content based on user feedback
    """
    logger.info("✏️ EDITOR: Refining content")
    engine = get_engine()
    existing_content = state.get("generated_content", {})
    
    if not existing_content:
        return {"generated_content": {"error": "No content to edit."}}
    
    content_str = "\n".join([f"{k}: {v}" for k, v in existing_content.items()])
    
    edit_prompt = f"""Modify this content based on: {state['raw_input']}
Current Content:
{content_str}"""
    
    try:
        response = engine.creative.invoke(edit_prompt)
        return {
            "generated_content": {
                "edited_content": response.content,
                "original": existing_content
            }
        }
    except Exception as e:
        return {"generated_content": existing_content}


@traceable(name="SARGE Clarification Node")
def clarification_node(state: AgentState) -> AgentState:
    """Ask user for more context when router confidence is low"""
    logger.info("🤔 CLARIFICATION: Asking for more context")
    confidence = state.get('router_confidence', 0)
    decision = state.get('router_decision', 'unknown')
    
    if decision == 'generate':
        message = f"I'm about {confidence:.0f}% sure you want to generate outreach, but I'm missing some details. Could you please provide the prospect's name, role, and company (or a LinkedIn URL)?"
    elif decision == 'refine':
        message = f"I think you want to change the outreach, but I'm not sure what to adjust. Could you specify what you'd like me to change (e.g., 'make it more formal' or 'shorten the second paragraph')?"
    else:
        message = f"I'm only {confidence:.0f}% sure what you need. Could you provide more details? I can help you analyze prospects, brainstorm strategies, and draft personalized outreach."
        
    return {
        "generated_content": {"clarification_message": message}
    }


@traceable(name="SARGE Fallback Node")
def fallback_node(state: AgentState) -> AgentState:
    """
    Handle unknown or out-of-scope inputs
    """
    logger.info("🚫 FALLBACK: Handling unknown input")
    raw_input = state['raw_input'].strip().lower()
    
    if len(raw_input) < 3:
        message = "I didn't catch that. Could you rephrase?"
    elif any(word in raw_input for word in ['weather', 'news', 'stock']):
        message = "I focus on Cold Outreach only. I can help with emails, LinkedIn, and WhatsApp."
    else:
        message = "I'm not sure. I can help with generating hyperpersonalized cold outreach. Try sending a name/company or a LinkedIn profile!"
    
    return {
        "generated_content": {"fallback_message": message}
    }
