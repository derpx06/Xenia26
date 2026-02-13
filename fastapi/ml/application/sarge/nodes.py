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
import re
import os
from typing import Optional, List
from ..agent.tools import duckduckgo_search, scrape_article, wikipedia_search
from agent_style_transfer.writing_style_inferrer import infer_style_rules, infer_few_shot_examples
from agent_style_transfer.schemas import Document
import uuid

try:
    from .tts_engine import XTTSEngine
    _TTS_IMPORT_ERROR = None
except Exception as e:
    XTTSEngine = None
    _TTS_IMPORT_ERROR = e


# Global KB singleton to prevent socket/file leaks
_kb = None
def get_kb():
    global _kb
    if _kb is None:
        _kb = SimpleKnowledgeBase()
    return _kb


# Global TTS singleton to avoid reloading models (DANGEROUS: RAM HEAVY)
_tts = None

def _refresh_tts_import_if_needed():
    global XTTSEngine, _TTS_IMPORT_ERROR
    if XTTSEngine is not None:
        return
    try:
        from .tts_engine import XTTSEngine as _XTTSEngine
        XTTSEngine = _XTTSEngine
        _TTS_IMPORT_ERROR = None
    except Exception as e:
        _TTS_IMPORT_ERROR = e

def get_tts():
    global _tts
    _refresh_tts_import_if_needed()
    if XTTSEngine is None:
        raise RuntimeError(str(_TTS_IMPORT_ERROR))

    if _tts is None:
        # Check if assets/speaker.wav exists for cloning, otherwise use default
        speaker_wav = "assets/speaker.wav"
        if not os.path.exists(speaker_wav) or os.path.getsize(speaker_wav) == 0:
            speaker_wav = None
            logger.warning("TTS: No speaker.wav found in assets/, using default voice.")

        _tts = XTTSEngine(speaker_wav=speaker_wav)
    return _tts


@traceable(name="SARGE Chat Node")
async def chat_node(state: AgentState) -> AgentState:
    """
    Fast conversational responses
    Preset C: Temperature 0.7, Text output
    Target: <1s latency
    """
    logger.info("💬 CHAT: Generating friendly response")
    
    engine = get_engine()
    
    # Build conversation context
    history = state.get("conversation_history", [])
    context = ""
    if history:
        for msg in history[-3:]:
             if isinstance(msg, dict):
                 role = msg.get('role', 'unknown').capitalize()
                 content = msg.get('content', '')
                 context += f"{role}: {content}\n"
             else:
                 context += str(msg) + "\n"
    
    prompt = f"""You are a helpful Cold Outreach Assistant.

You DO NOT answer general questions like weather, news, or coding. If a user asks these, politely reply that you only help with cold outreach and direct them to provide a prospect for analysis.

Previous conversation:
{context if context else "No previous conversation"}

User: {state['raw_input']}

Respond briefly and helpfully in the context of cold outreach ONLY."""
    
    try:
        response = await engine.creative.ainvoke(prompt)
        
        # Update conversation history
        new_message_user = {"role": "user", "content": state['raw_input']}
        new_message_assistant = {"role": "assistant", "content": response.content}
        
        new_history = history + [new_message_user, new_message_assistant]
        
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


@traceable(name="SARGE Style Inferrer Node")
async def style_inferrer_node(state: AgentState) -> AgentState:
    """
    Detect and infer writing style from reference URLs or text
    """
    raw_input = state.get("raw_input", "")
    logger.info("🎨 STYLE: Checking for style references")
    
    # Simple regex to find URLs
    urls = re.findall(r'(https?://[^\s]+)', raw_input)
    
    if not urls:
        return {"writing_style": None}
    
    ref_url = urls[0]
    logger.info(f"🎨 STYLE: Inferring style from {ref_url}")
    
    try:
        # 1. Scrape the content
        content = await scrape_article.ainvoke({"url": ref_url})
        
        # 2. Create a Document object
        doc = Document(
            url=ref_url,
            content=content,
            title="Style Reference",
            type="Blog", # Defaulting
            category="Professional"
        )
        
        # 3. Infer style using our specialized tool
        # Run sync functions in thread to keep event loop responsive
        rules = await asyncio.to_thread(infer_style_rules, [doc], provider="ollama")
        examples = await asyncio.to_thread(infer_few_shot_examples, [doc], provider="ollama")
        
        style_result = {
            "rules": rules,
            "examples": [ex.model_dump() for ex in examples],
            "reference_url": ref_url
        }
        
        logger.info(f"🎨 STYLE: Extracted {len(rules)} rules and {len(examples)} examples")
        return {"writing_style": style_result}
        
    except Exception as e:
        logger.warning(f"🎨 STYLE: Style inference failed - {e}")
        return {"writing_style": None}


@traceable(name="SARGE Profiler Node")
async def profiler_node(state: AgentState) -> AgentState:
    """
    Extract structured prospect data
    Preset B: Temperature 0.1, JSON output
    """
    logger.info("🔍 PROFILER: Extracting prospect data")
    
    engine = get_engine()
    
    # Setup structured output from shared engine
    llm_client = engine.structured
    
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
7. research_queries: Identify 1-2 specific technical topics or claims mentioned in the user instructions that require research (e.g., "CUDA-X edge computing", "latest earnings report"). 

Return valid JSON with these exact fields. Use null for missing optional fields, never leave fields undefined.
STRICT: DO NOT invent topics. Only extract what is explicitly or strongly implied in the INPUT TEXT.
"""
    
    try:
        profile: ProspectProfile = await llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=ProspectProfile,
            messages=[
                {"role": "system", "content": "Extract structured prospect data. Default 'Unknown' if missing."},
                {"role": "user", "content": extraction_prompt}
            ],
            temperature=0.0,
            max_retries=2
        )
        
        profile_dict = profile.model_dump()
        
        # Safety defaults if LLM returned nulls
        if not profile_dict.get("name"): 
            profile_dict["name"] = "Unknown Prospect"
        if not profile_dict.get("detected_tone"):
            profile_dict["detected_tone"] = "formal"
            
        logger.info(f"🔍 PROFILER: Extracted profile for {profile_dict['name']}")
        
        # --- PHASE 3: NEWS JACKING & TOPIC SEARCH (PARALLELIZED) ---
        research_tasks = []
        company = profile_dict.get("company")
        name = profile_dict.get("name")
        topics = profile_dict.get("research_queries", [])
        
        # 1. Target Topic Search
        for topic in topics:
            logger.info(f"📡 RESEARCH: Queuing topic search: {topic}")
            research_tasks.append(duckduckgo_search.ainvoke({"query": f"{topic} latest details 2026"}))

        # 2. Company/News Search
        if company and company not in ["Unknown", "your organization"]:
            logger.info(f"📡 RESEARCH: Queuing news search for {company}")
            research_tasks.append(duckduckgo_search.ainvoke({"query": f"recent news {company} 2026"}))
                
        # 3. Individual Search (Fallback)
        if name and name not in ["Unknown", "Unknown Prospect"]:
            logger.info(f"📡 RESEARCH: Queuing background search for {name}")
            research_tasks.append(duckduckgo_search.ainvoke({"query": f"{name} professional background 2026"}))

        # Run all searches in parallel
        if research_tasks:
            results = await asyncio.gather(*research_tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, str):
                    research_context.append(res)
                elif isinstance(res, Exception):
                    logger.warning(f"📡 RESEARCH: A search task failed - {res}")

        final_context = "\n\n---\n\n".join(research_context)
        
        return {
            "prospect_data": profile_dict,
            "news_context": final_context if final_context else None,
            "generation_attempts": 0 
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
async def strategist_node(state: AgentState) -> AgentState:
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
        openai.AsyncOpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama"
        ),
        mode=instructor.Mode.JSON
    )

    strategy_prompt = f"""You are a top-tier Sales Strategist. Design a hyperpersonalized outreach strategy for maximum attention.

PROSPECT DATA:
- Name: {prospect.get('name')}
- Role: {prospect.get('role')}
- Company: {prospect.get('company')}
- Interests: {', '.join(prospect.get('key_interests', []))}
- Industry: {prospect.get('industry')}

NEWS CONTEXT (RECENT COMPANY NEWS):
{state.get('news_context', 'No recent news found.')}

GOAL: Stop the scroll. Find a specific "Hook" based on their RECENT ACTIVITY, POSTS, or the NEWS CONTEXT above.
Avoid generic openers like "I hope this finds you well".
Focus on:
1. Recent news/events about their company (News Jacking)
2. Recent posts/articles they shared or wrote (High Attention)
3. Specific projects or achievements (High Relevance)
4. pattern interrupts - something unexpected but relevant.

Required Output:
1. hook: A specific, high-intent opener referencing their company news or recent activity.
2. value_prop: How we solve a problem specific to their role/interests.
3. pain_point: A likely challenge they face in their current position.
4. recommended_tone: Nuanced tone suggestion (e.g. "approachable but technical")."""

    try:
        strategy: StrategyBrief = await llm_client.chat.completions.create(
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
async def retriever_node(state: AgentState) -> AgentState:
    """
    Query ChromaDB for successful past outreach templates
    """
    logger.info("📚 RETRIEVER: Querying past successful templates")
    
    kb = get_kb()
    prospect = state.get("prospect_data", {})
    industry = prospect.get("industry", "Unknown")
    role = prospect.get("role", "Unknown")
    
    kb = get_kb()
    
    # --- TURBO: Query ChromaDB with Keywords directly ---
    # No HyDE, just keyword-driven vector search
    query = f"Outreach for {role} in {industry}"
    past_examples = await asyncio.to_thread(kb.get_similar_outreach, query, limit=3)
    
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
    
    # Handle Unknown Prospect case gracefully
    if not prospect:
        prospect = {"name": None}
    
    name = prospect.get("name")
    if name in ["Unknown", "Unknown Prospect", "there"]:
        name = None
    
    role = prospect.get("role")
    if role in ["Unknown", "your role"]:
        role = "Executive"
        
    company = prospect.get("company")
    if company in ["Unknown", "your company"]:
        company = "your organization"
    tone = strategy.get("recommended_tone", prospect.get("detected_tone", "formal"))
    
    # DYNAMIC INSTRUCTIONS (Originality First)
    originality_meta = """
!!! ORIGINALITY FIRST !!!
- DO NOT rely on rigid templates.
- Write from scratch based on the Prospect context and User instructions.
- Avoid common 'salesy' patterns.
"""

    # --- PHASE 3: STYLE TRANSFER INJECTION ---
    writing_style = state.get("writing_style")
    style_notes = ""
    if writing_style:
        rules = "\n".join([f"- {r}" for r in writing_style.get("rules", [])])
        examples = writing_style.get("examples", [])
        examples_str = ""
        for ex in examples[:2]:
            examples_str += f"\nExample Input: {ex.get('input')}\nExample Output: {ex.get('output')}\n"
            
        style_notes = f"""
!!! STRICT STYLE RULES (OBEY THESE) !!!
{rules}

FEW-SHOT STYLE EXAMPLES:
{examples_str}
"""
        logger.info("✍️ WRITER: Injecting custom writing style")

    news_info = ""
    if state.get("news_context"):
        news_info = f"\nRECENT NEWS CONTEXT:\n{state.get('news_context')}\n"

    past_context = ""
    if templates:
        past_context = "\n[VOLATILE REFERENCE ONLY] PAST TEMPLATES:\n" + "\n---\n".join(templates) + "\n(NOTE: Use these only as background info. Do NOT copy their structure.)"

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
    # --- TURBO: Merge Strategist logic into Writer prompts ---
    email_prompt = f"""You are a world-class Executive Outreach Specialist.
Your task is to write a high-prestige, catchy email to {name if name else "the prospect"}.

!!! STICKY USER INSTRUCTIONS (COMPLY FULLY) !!!
{state.get('raw_input', 'N/A')}

[STRATEGIC BRAINSTORM]
- Prospect Context: {name if name else "Executive"} ({role} at {company}).
- Research Hook: {state.get('news_context', 'N/A')}.
- Pattern Interrupt: Find a non-obvious, sharp opening.
- Credibility Anchor: Use Social Proof to establish prestige.

[EXECUTIVE DRAFT]
Subject: [Sharp, Catchy Subject - 4-6 words]
Content:
(Personalized email starting with the Pattern Interrupt)
- CRITICAL: FOLLOW THE USER INSTRUCTIONS ABOVE EXACTLY. If they want to talk about CUDA-X, talk about CUDA-X.
- NO META-COMMENTARY. DO NOT mention the search process or what you couldn't find.
- NEVER say: "I couldn't find news about...", "As no recent news was found...", etc.
- NO PLACEHOLDERS: NEVER use brackets like [Name], [Company], [Your Name], or [insert number]. 
- No Fluff: Delete "I hope this finds you well" or "My name is...".
- Tone: {tone} (Prestige/Executive).
- Length: 100-250 words. MEATY and substantial.
- Context: {past_context}
- Previous Feedback: {critic_notes}
- Salutation: If name unknown, avoid "Hi there". Use "Hi," or jump straight to the point.
"""

    linkedin_prompt = f"""Write a CATCHY LinkedIn DM (400-600 characters) for {name if name else "this lead"}.
!!! USER INSTRUCTIONS !!!
{state.get('raw_input', 'N/A')}

HOOK: Based on {company} or their industry.
- NO SUBJECT.
- FOLLOW USER INSTRUCTIONS EXACTLY.
- NO PLACEHOLDERS or missing news apologies.
- Tone: {tone}. Hyper-direct."""

    whatsapp_prompt = f"""Write an IMPACTFUL WhatsApp message (3-5 substantial sentences) for {name if name else "this lead"}.
!!! USER INSTRUCTIONS !!!
{state.get('raw_input', 'N/A')}

Target: {name if name else "this lead"}. 
- FOLLOW USER INSTRUCTIONS EXACTLY.
- No apologies for missing news. No placeholders like []. 
- Be direct but give enough context to be truly compelling."""

    # NEW: Get requested channels from state (default to email only for speed/quality balance)
    requested_channels = state.get("requested_channels")
    if not requested_channels:
        requested_channels = ["email"]
    
    logger.info(f"✍️ WRITER: Generating for channels: {requested_channels}")
    
    # Load existing content to preserve successful generations
    existing_content = state.get("generated_content", {})
    
    # Build tasks only for requested channels
    tasks = []
    channel_order = []
    
    async def _stream_channel(channel_name, prompt):
        full_content = ""
        config = {"tags": [f"channel:{channel_name}"]}
        async for chunk in engine.creative.astream(prompt, config=config):
            full_content += chunk.content
        return full_content

    if "email" in requested_channels:
        tasks.append(_stream_channel("email", email_prompt))
        channel_order.append("email")
    if "linkedin" in requested_channels:
        tasks.append(_stream_channel("linkedin", linkedin_prompt))
        channel_order.append("linkedin")
    if "whatsapp" in requested_channels:
        tasks.append(_stream_channel("whatsapp", whatsapp_prompt))
        channel_order.append("whatsapp")
    
    # Parallel execution of only requested channels
    results = await asyncio.gather(*tasks)
    
    # Build contents dict, merging with existing content
    contents = existing_content.copy()  # Start with existing content
    
    for i, channel in enumerate(channel_order):
        contents[channel] = results[i]

    return {
        "generated_content": contents,
        "generation_attempts": state.get("generation_attempts", 0) + 1
    }


@traceable(name="SARGE Critic Node")
async def critic_node(state: AgentState) -> AgentState:
    """
    Evaluate content quality and personalization with rigorous rigour
    Preset A: Temperature 0.0, JSON output
    """
    logger.info("⚖️ CRITIC: Evaluating content quality (Rigorous)")
    
    engine = get_engine()
    content = state.get("generated_content", {})
    prospect = state.get("prospect_data", {}) or {}
    name = prospect.get("name", "Unknown")
    company = prospect.get("company", "Unknown")
    attempts = state.get("generation_attempts", 0)
    
    if "error" in content:
        return {"critic_feedback": {"score": 1, "is_ready": False, "critique": "Generation failed."}}

    evaluation_prompt = f"""You are a strict Quality Critic for sales outreach.
Evaluate these messages based on Catchiness, Credibility, and Personalization.

CRITERIA:
1. Catchiness: Is there a "Pattern Interrupt"? (Boring subject or opening = <4)
2. Credibility: Is there Social Proof (specific achievements or data points)? (Vague = <5)
3. Personalization: Does it mention {company} or {name} specifically?

CONTENT:
EMAIL: {content.get('email', 'N/A')}
LINKEDIN: {content.get('linkedin', 'N/A')}

JSON FIELDS TO RETURN:
- score: int (Overall Score 1-10)
- critique: str (15-word reason specifically why catchiness/credibility failed)
- is_ready: bool (True if score >= 8)
"""

    # Setup structured output from shared engine
    llm_client = engine.structured

    try:
        feedback: CriticFeedback = await llm_client.chat.completions.create(
            model=engine.model_name,
            response_model=CriticFeedback,
            messages=[
                {"role": "system", "content": "You are a rigorous quality critic. Focus on high personalization."},
                {"role": "user", "content": evaluation_prompt}
            ],
            temperature=0.1,
            max_retries=2
        )
        
        # PARTIAL RETRY LOGIC
        # Identify which channels need regeneration (score < 8)
        failed_channels = []
        scores = feedback.channel_scores or {}
        
        # If no detailed scores, assume all failed if overall score is low
        overall_score = feedback.score or 0
        if not scores and overall_score < 8:
            failed_channels = state.get("requested_channels", ["email"])
        else:
            for channel, score in scores.items():
                if (score is None or score < 8) and channel in state.get("requested_channels", []):
                    failed_channels.append(channel)
        
        # Determine readiness
        is_ready = len(failed_channels) == 0
        if is_ready:
            feedback.is_ready = True
            
        logger.info(f"⚖️ CRITIC: Score={feedback.score} | Channel Scores={scores} | Rework Needed: {failed_channels}")
        
        return {
            "critic_feedback": feedback.model_dump(),
            "requested_channels": failed_channels  # ONLY retry these channels in next writer pass
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
async def editor_node(state: AgentState) -> AgentState:
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
async def clarification_node(state: AgentState) -> AgentState:
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
async def fallback_node(state: AgentState) -> AgentState:
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


@traceable(name="SARGE Voice Node")
async def voice_node(state: AgentState) -> AgentState:
    """
    Generate audio outreach draft using TTS
    """
    logger.info("🎙️ VOICE: Generating audio draft")
    content = state.get("generated_content", {})
    text_to_speak = content.get("email") or content.get("linkedin") or content.get("chat_response")
    
    if not text_to_speak:
        logger.warning("🎙️ VOICE: No text content found to speak")
        return {}

    # Clean text (remove subject line if email)
    clean_text = re.sub(r'^Subject:.*?\n', '', text_to_speak, flags=re.MULTILINE|re.IGNORECASE)
    clean_text = clean_text.strip()[:1000] # Limit length for speed
    
    try:
        if XTTSEngine is None:
            logger.warning(f"TTS dependencies missing ({_TTS_IMPORT_ERROR}); skipping audio generation.")
            return {}
        tts_engine = await asyncio.to_thread(get_tts)
        
        # Create static audio dir if it doesn't exist (fail-safe)
        os.makedirs("static/audio", exist_ok=True)
        
        filename = f"outreach_{uuid.uuid4().hex[:8]}.wav"
        file_path = os.path.join("static/audio", filename)
        
        # Run synthesis in thread to avoid blocking main loop
        await asyncio.to_thread(
            tts_engine.speak,
            text=clean_text,
            output_path=file_path
        )
        
        # Audio URL for frontend
        audio_url = f"/static/audio/{filename}"
        
        # Update generated content with audio path
        new_content = content.copy()
        new_content["audio_path"] = audio_url
        
        return {
            "generated_content": new_content
        }
        
    except Exception as e:
        logger.error(f"🎙️ VOICE: Audio generation failed - {e}")
        return {}

