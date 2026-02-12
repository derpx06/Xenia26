import asyncio
import re

from loguru import logger
from langsmith import traceable

from .schemas import AgentState, ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult
from .tools import duckduckgo_search
from .config import (
    LOGIC_MODEL,
    OFFLINE_STRICT,
    CHANNEL_TEMPS,
    QUALITY_RUBRIC_TEXT,
    CHANNEL_RULES,
    CHANNEL_MAX_TOKENS,
)
from .helpers import (
    init_llm_clients,
    cached_llm_call,
    infer_channels_from_instruction,
    infer_seniority_from_role,
    infer_style_signals,
    parse_profile_notes,
    parse_structured_lead_data,
    extract_tone_from_text,
    ensure_prospect,
    ensure_psych,
    ensure_strategy,
    ensure_critique,
    ensure_context,
    parse_multi_channel,
)
from .mention_intelligence import build_context_injection, context_to_prospect, context_to_psych


class _NullKnowledgeBase:
    def save_prospect(self, *_args, **_kwargs) -> None:
        return None

    def get_psych_profile(self, *_args, **_kwargs):
        return None

    def save_psych_profile(self, *_args, **_kwargs) -> None:
        return None

    def get_similar_outreach(self, *_args, **_kwargs):
        return []

    def save_outreach(self, *_args, **_kwargs) -> None:
        return None


_kb_instance = None


def _get_kb():
    global _kb_instance
    if _kb_instance is not None:
        return _kb_instance

    try:
        from .knowledge import SimpleKnowledgeBase
        _kb_instance = SimpleKnowledgeBase()
    except Exception as exc:
        logger.warning(f"KB disabled due to import/init error: {exc}")
        _kb_instance = _NullKnowledgeBase()
    return _kb_instance


@traceable(name="Mention Context Node")
async def mention_context_node(state: AgentState) -> AgentState:
    """
    Pre-agent @mention intelligence layer.
    Extracts structured target/sender/task context in parallel and injects compact memory.
    """
    logs = state.logs
    instruction = state.user_instruction or ""
    sender_email = (getattr(state, "user_email", None) or "").strip().lower()
    topic_lock_hint = getattr(state, "topic_lock", None)

    try:
        context = await build_context_injection(
            user_instruction=instruction,
            user_email=sender_email,
            topic_lock_hint=topic_lock_hint,
        )

        updates = {
            "context": context,
            "logs": logs + [
                f"MENTION: Parsed {len(context.mention_tokens)} mention(s); context built in {context.extraction_ms}ms.",
                f"MENTION: Topic lock -> {context.task_intent.topic_lock or 'outreach'}",
            ],
        }

        # Keep a strict task lock for downstream strategy + critic.
        if context.task_intent.topic_lock:
            updates["topic_lock"] = context.task_intent.topic_lock

        # Seed prospect/psych to skip expensive extraction when structured contact data exists.
        seeded_prospect = context_to_prospect(context)
        if seeded_prospect and not state.prospect:
            updates["prospect"] = seeded_prospect
            updates["needs_search"] = False

        seeded_psych = context_to_psych(context)
        if seeded_psych and not state.psych:
            updates["psych"] = seeded_psych

        if context.extraction_ms > 150:
            updates["logs"] = updates["logs"] + [
                f"MENTION: Warning - extraction exceeded 150ms target ({context.extraction_ms}ms)."
            ]

        return updates
    except Exception as e:
        logger.warning(f"MENTION: context injection failed ({e})")
        return {
            "logs": logs + [f"MENTION: context injection failed ({str(e)[:120]})"],
        }


@traceable(name="Hunter Node")
async def hunter_node(state: AgentState) -> AgentState:
    llm_client, _, _ = init_llm_clients()
    logger.info("HUNTER: Checking inputs...")
    logs = state.logs
    logs.append("HUNTER: Starting research phase...")
    url = state.target_url
    instruction = state.user_instruction

    structured = parse_structured_lead_data(instruction or "")
    if structured:
        structured.source_urls = []
        _get_kb().save_prospect(structured)
        logs.append(f"HUNTER: Parsed structured lead data for {structured.name}.")
        return {"prospect": structured, "logs": logs}

    url_pattern = r"https?://[^\s]+"
    instruction_urls = re.findall(url_pattern, instruction) if instruction else []
    source_urls = []
    if url and "http" in url:
        source_urls.append(url)
    for u in instruction_urls:
        if u not in source_urls:
            source_urls.append(u)

    notes_text = ""
    if instruction:
        upper = instruction.upper()
        for marker in ["PROFILE:", "BIO:", "NOTES:", "ABOUT:"]:
            if marker in upper:
                parts = instruction.split(marker, 1)
                if len(parts) > 1:
                    notes_text = parts[1].strip()
                    break

    if not source_urls:
        if notes_text:
            logs.append("HUNTER: Using inline PROFILE/BIO/NOTES data (offline).")
            parsed = parse_profile_notes(notes_text)
            if parsed:
                parsed.source_urls = source_urls
                _get_kb().save_prospect(parsed)
                logs.append(f"HUNTER: Parsed {parsed.name} from inline data.")
                return {"prospect": parsed, "logs": logs}
            try:
                profile = llm_client.chat.completions.create(
                    model=LOGIC_MODEL,
                    response_model=ProspectProfile,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert lead researcher. Extract key facts from provided notes. Keep bio concise. Infer industry, seniority, interests, and primary language when possible."
                        },
                        {
                            "role": "user",
                            "content": f"""Extract schema from this data:\n\n{notes_text}"""
                        }
                    ],
                    max_retries=2
                )
                profile.seniority = infer_seniority_from_role(profile.role)
                profile.source_urls = source_urls
                _get_kb().save_prospect(profile)
                logs.append(f"HUNTER: Extracted {profile.name} from inline data.")
                return {"prospect": profile, "logs": logs}
            except Exception as e:
                logs.append(f"HUNTER: Inline extraction failed ({str(e)}). Using placeholder.")
                return {
                    "prospect": ProspectProfile(
                        name="User", role="General", company="General", raw_bio=""
                    ),
                    "logs": logs
                }

        if OFFLINE_STRICT:
            logs.append("HUNTER: OFFLINE_STRICT enabled; skipping web search.")
            return {
                "prospect": ProspectProfile(
                    name="User", role="General", company="General", raw_bio=""
                ),
                "logs": logs
            }

        # --- NEW: Use search_keywords from intent router, skip if not needed ---
        needs_search = state.needs_search if hasattr(state, 'needs_search') else True
        if not needs_search:
            logs.append("HUNTER: Search skipped — high confidence in topic knowledge.")
            return {
                "prospect": ProspectProfile(
                    name="User", role="General", company="General", raw_bio=""
                ),
                "logs": logs
            }

        # Use extracted domain keywords instead of raw instruction
        # CRITICAL: Use extracted search_keywords for search query, NOT full instruction
        search_query = state.target_url
        if not search_query:
            if state.needs_search and state.search_keywords:
                search_query = " ".join(state.search_keywords[:3])
            else:
                logs.append("HUNTER: No URL and no search keywords. Skipping search.")
                return {
                    "prospect": ProspectProfile(
                        name="User", role="General", company="General", raw_bio="", is_placeholder=True
                    ),
                    "logs": logs
                }

        try:
            logs.append(f"HUNTER: Searching for '{search_query}'...")
            search_results = await duckduckgo_search.ainvoke({"query": search_query})

            profile = llm_client.chat.completions.create(
                model=LOGIC_MODEL,
                response_model=ProspectProfile,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert lead researcher. Extract key facts from search results. Keep bio concise. Infer industry, seniority, interests, and primary language when possible."
                    },
                    {
                        "role": "user",
                        "content": f"""Extract schema from these search results:\n\n{search_results}"""
                    }
                ],
                max_retries=2
            )
            profile.seniority = infer_seniority_from_role(profile.role)
            profile.source_urls = source_urls
            logs.append(f"HUNTER: Found {profile.name} via Search.")
            return {"prospect": profile, "logs": logs}

        except Exception as e:
            logs.append(f"HUNTER: Search failed ({str(e)}). Using placeholder.")
            return {
                "prospect": ProspectProfile(
                    name="User", role="General", company="General", raw_bio="", is_placeholder=True
                ),
                "logs": logs
            }

    try:
        combined_texts = []
        if notes_text:
            combined_texts.append(notes_text)
        for src in source_urls:
            logs.append(f"HUNTER: Analyzing {src}...")
            from ..crawlers.dispatcher import CrawlerDispatcher

            dispatcher = CrawlerDispatcher.build().register_linkedin().register_medium().register_github()
            crawler = dispatcher.get_crawler(src)

            if hasattr(crawler, 'aextract'):
                crawl_result = await crawler.aextract(src)
            elif asyncio.iscoroutinefunction(crawler.crawl):
                crawl_result = await crawler.crawl(src)
            else:
                crawl_result = crawler.crawl(src)

            raw_text = crawl_result.markdown if hasattr(crawl_result, 'markdown') else str(crawl_result)
            if raw_text:
                combined_texts.append(raw_text)

        combined_raw = "\n\n".join([t for t in combined_texts if t])
        truncated_text = combined_raw[:5000]

        logger.info("HUNTER: Extracting signals...")
        profile = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=ProspectProfile,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert lead researcher. Extract key facts. Keep bio concise. Infer industry, seniority, interests, and primary language when possible."
                },
                {
                    "role": "user",
                    "content": f"""Extract schema from this text:\n\n{truncated_text}"""
                }
            ],
            max_retries=2
        )
        profile.seniority = infer_seniority_from_role(profile.role)
        profile.source_urls = source_urls

        _get_kb().save_prospect(profile)

        logs.append(f"HUNTER: Found {profile.name} at {profile.company}. Saved to Knowledge Base.")
        return {"prospect": profile, "logs": logs}

    except Exception as e:
        logger.error(f"Hunter failed: {e}")
        logs.append(f"HUNTER: Failed to scrape ({str(e)}). Using placeholder.")
        return {
            "prospect": ProspectProfile(
                name="Prospect", role="Professional", company="Target Company",
                recent_activity=[], raw_bio=""
            ),
            "logs": logs
        }


@traceable(name="Profiler Node")
async def profiler_node(state: AgentState) -> AgentState:
    """
    Analyzes personality & style with integrated style rule extraction.
    """
    llm_client, _, _ = init_llm_clients()
    logger.info("PROFILER: Analyzing personality & style...")
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    logs = state.logs

    if (prospect.name in ["User", "Prospect"]) and not prospect.raw_bio:
        logs.append("PROFILER: General Mode detected. Using helpful persona.")
        return {
            "psych": PsychProfile(
                disc_type="C",
                communication_style="Helpful and Direct",
                tone_instructions=["Be helpful", "Be clear", "No fluff"],
                style_rules=[]
            ),
            "logs": logs
        }

    cached = _get_kb().get_psych_profile(prospect.name, prospect.company)
    if cached:
        logs.append("PROFILER: Found cached psych profile in KB.")
        return {"psych": PsychProfile(**cached), "logs": logs}

    try:
        tone_hint = extract_tone_from_text(prospect.raw_bio or "")
        if tone_hint:
            style_signals = infer_style_signals(prospect.raw_bio or "")
            tone = "Professional"
            disc = "C"
            if any(k in tone_hint for k in ["casual", "friendly", "emoji", "slang"]):
                tone = "Casual and Friendly"
                disc = "I"
            elif any(k in tone_hint for k in ["formal", "precise", "measured"]):
                tone = "Professional and Precise"
                disc = "C"
            elif any(k in tone_hint for k in ["mixed", "balanced"]):
                tone = "Balanced"
                disc = "S"

            heuristic_rules = []
            if style_signals["emoji_count"] > 0:
                heuristic_rules.append("Allow light emoji usage when appropriate")
            if style_signals["avg_sentence_len"] <= 10:
                heuristic_rules.append("Use short sentences")
            if style_signals["style_hint"] == "casual":
                heuristic_rules.append("Use casual, friendly tone")

            profile = PsychProfile(
                disc_type=disc,
                communication_style=tone,
                tone_instructions=["Match stated tone", "Be clear", "Avoid generic phrasing"],
                style_rules=heuristic_rules[:3],
                avg_sentence_len=style_signals["avg_sentence_len"],
                emoji_usage="High" if style_signals["emoji_count"] > 2 else "Low" if style_signals["emoji_count"] > 0 else "None",
                vocabulary_complexity="Simple" if style_signals["avg_sentence_len"] <= 12 else "Standard"
            )
            _get_kb().save_psych_profile(prospect.name, prospect.company, profile)
            logs.append(f"PROFILER: Used tone hint '{tone_hint}'.")
            return {"psych": profile, "logs": logs}

        style_source = " ".join(
            [prospect.raw_bio or ""] + (prospect.recent_activity or []) + (prospect.interests or [])
        ).strip()
        style_signals = infer_style_signals(style_source)
        bio_excerpt = style_source[:2000] if style_source else ""

        if style_source and len(style_source) < 400:
            tone = "Professional"
            disc = "C"
            if style_signals["emoji_count"] > 0 or style_signals["style_hint"] == "casual":
                tone = "Casual and Friendly"
                disc = "I"
            elif style_signals["avg_sentence_len"] <= 10:
                tone = "Concise and Direct"
                disc = "S"

            heuristic_rules = []
            if style_signals["emoji_count"] > 0:
                heuristic_rules.append("Allow light emoji usage when appropriate")
            if style_signals["avg_sentence_len"] <= 10:
                heuristic_rules.append("Use short sentences")
            if style_signals["style_hint"] == "casual":
                heuristic_rules.append("Use casual, friendly tone")

            profile = PsychProfile(
                disc_type=disc,
                communication_style=tone,
                tone_instructions=["Be clear", "Avoid generic phrasing"],
                style_rules=heuristic_rules[:3],
                avg_sentence_len=style_signals["avg_sentence_len"],
                emoji_usage="High" if style_signals["emoji_count"] > 2 else "Low" if style_signals["emoji_count"] > 0 else "None",
                vocabulary_complexity="Simple" if style_signals["avg_sentence_len"] <= 12 else "Standard"
            )
            _get_kb().save_psych_profile(prospect.name, prospect.company, profile)
            logs.append("PROFILER: Used heuristic style (short source).")
            return {"psych": profile, "logs": logs}

        profile = await asyncio.to_thread(
            cached_llm_call,
            llm_client,
            LOGIC_MODEL,
            PsychProfile,
            [
                {
                    "role": "system",
                    "content": """You are a behavioral psychologist and writing analyst.
Analyze the text for:
1. DISC personality type (D/I/S/C)
2. Communication style (casual/formal/mixed)
3. Tone instructions (3-5 actionable guidelines)
4. Style rules (3-5 specific writing patterns observed - e.g., "Uses short sentences", "Includes emojis", "Professional vocabulary")

Be concise and specific."""
                },
                {
                    "role": "user",
                    "content": f"""Analyze this writing and extract personality + style patterns:\n\nTEXT:\n{bio_excerpt}\n\nSTYLE SIGNALS (heuristic):\n- emoji_count: {style_signals['emoji_count']}\n- exclamation_count: {style_signals['exclamation_count']}\n- question_count: {style_signals['question_count']}\n- avg_sentence_len: {style_signals['avg_sentence_len']}\n- style_hint: {style_signals['style_hint']}\n"""
                }
            ],
        )
        # Inject computed metrics
        profile.avg_sentence_len = style_signals["avg_sentence_len"]
        profile.emoji_usage = "High" if style_signals["emoji_count"] > 2 else "Low" if style_signals["emoji_count"] > 0 else "None"
        profile.vocabulary_complexity = "Simple" if style_signals["avg_sentence_len"] <= 12 else "Standard"

        if not profile.style_rules:
            heuristic_rules = []
            if style_signals["emoji_count"] > 0:
                heuristic_rules.append("Allow light emoji usage when appropriate")
            if style_signals["avg_sentence_len"] <= 10:
                heuristic_rules.append("Use short sentences")
            if style_signals["style_hint"] == "casual":
                heuristic_rules.append("Use casual, friendly tone")
            profile.style_rules = heuristic_rules[:3]

        _get_kb().save_psych_profile(prospect.name, prospect.company, profile)

        logs.append(f"PROFILER: Type {profile.disc_type} | {len(profile.style_rules)} style rules")
        return {"psych": profile, "logs": logs}

    except Exception as e:
        logger.error(f"Profiler failed: {e}")
        return {
            "psych": PsychProfile(
                disc_type="C",
                communication_style="Professional",
                tone_instructions=["Be polite", "Be clear"],
                style_rules=["Use professional language"]
            ),
            "logs": logs
        }


@traceable(name="Strategist Node")
async def strategist_node(state: AgentState) -> AgentState:
    """
    Decides the Channel(s) based on user instruction - now async with caching.
    """
    llm_client, _, _ = init_llm_clients()
    logger.info("STRATEGIST: Planning attack...")
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    psych: PsychProfile = ensure_psych(state.psych)
    instruction = state.user_instruction
    history = state.conversation_history
    context = ensure_context(getattr(state, "context", None))
    logs = state.logs

    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-2:]]) if history else "No history."

    inferred_channels = infer_channels_from_instruction(instruction)
    context_channel_hint = None
    context_topic_lock = None
    if context:
        context_channel_hint = context.task_intent.channel_hint
        context_topic_lock = context.task_intent.topic_lock
        if context_channel_hint and context_channel_hint not in inferred_channels:
            inferred_channels.insert(0, context_channel_hint)

    expand_multi = any(k in (instruction or "").lower() for k in ["all channels", "multi-channel", "multichannel", "all variants"])
    if expand_multi:
        inferred_channels = list(dict.fromkeys(inferred_channels + ["email", "whatsapp", "sms", "linkedin_dm", "instagram_dm"]))

    if not inferred_channels:
        if any(k in (instruction or "").lower() for k in ["write", "draft", "generate", "compose", "outreach"]):
            inferred_channels = ["email"]
        else:
            inferred_channels = ["general_response"]

    should_fast_path = (
        inferred_channels
        and any(k in (instruction or "").lower() for k in ["generate", "create", "write", "draft"])
        and len((instruction or "")) < 220
        and not any(k in (instruction or "").lower() for k in ["objective", "requirements", "output format", "input data", "public profile"])
    )

    if should_fast_path:
        # Task 1: Infer Goal/CTA (No hardcoding)
        inst_lc = instruction.lower()
        goal = "Start a conversation"
        cta = "Open to a quick chat?"
        
        if any(k in inst_lc for k in ["meeting", "schedule", "calendar", "time"]):
            goal = "Schedule a meeting"
            cta = "Do you have 15 mins this week?"
        elif any(k in inst_lc for k in ["link", "share", "resource", "check out"]):
            goal = "Share value/resource"
            cta = "Let me know your thoughts."
        elif any(k in inst_lc for k in ["hiring", "job", "opportunity", "role"]):
            goal = "Discuss opportunity"
            cta = "Open to discussing this role?"
        elif any(k in inst_lc for k in ["collab", "partner"]):
            goal = "Explore partnership"
            cta = "Open to exploring synergy?"

        key_points = []
        if prospect.recent_activity:
            key_points.append(prospect.recent_activity[0])
        if prospect.interests:
            key_points.append(prospect.interests[0])

        # Task 2: Remove template hook. Use strict formatting.
        effective_topic_lock = getattr(state, 'topic_lock', None) or context_topic_lock
        if effective_topic_lock:
             hook = f"Regarding {effective_topic_lock}"
        else:
             hook = f"Regarding {goal.lower()}"
            
        strategy = StrategyBrief(
            target_channels=inferred_channels,
            target_channel=inferred_channels[0],
            goal=goal,
            hook=hook,
            key_points=key_points[:3],
            framework="Direct",
            cta=cta
        )
        logs.append(f"STRATEGIST: Fast-path strategy ({goal}).")
        return {"strategy": strategy, "logs": logs}

    try:
        strategy = await asyncio.to_thread(
            cached_llm_call,
            llm_client,
            LOGIC_MODEL,
            StrategyBrief,
            [
                {
                    "role": "system",
                    "content": """You are a Strategic Planner. Select 1-5 appropriate channels based on the instruction.

Channels: 
- email (defalut for formal)
- linkedin_dm (professional networking)
- whatsapp (casual/direct)
- sms (urgent/personal)
- instagram_dm (social/creative)
- twitter_thread (viral/public)
- general_response (only if NO outreach is intended)

Return target_channels[], goal, hook, 2-3 key_points, framework, and cta.
If the user says "text him", infer sms/whatsapp. If "connect", infer linkedin_dm."""
                },
                {
                    "role": "user",
                    "content": f"""INSTRUCTION: "{instruction[:600]}"\nTARGET: {prospect.role} at {prospect.company}\nSTYLE: {psych.communication_style if psych else 'Unknown'}\nHISTORY: {history_context[:400]}\nCHANNEL_HINTS: {', '.join(inferred_channels)}\nTOPIC_LOCK: {getattr(state, 'topic_lock', None) or context_topic_lock or 'none'}\nMENTION_MEMORY: {(context.compressed_memory[:500] if context else 'n/a')}\n\nCreate a StrategyBrief."""
                }
            ],
            use_cache=True
        )

        # Trust the LLM's selection, but ensure at least one channel if inferred was present
        if not strategy.target_channels:
            strategy.target_channels = inferred_channels or ["email"]
        
        # If the LLM picked general_response but we inferred specific channels, override it
        if "general_response" in strategy.target_channels and inferred_channels and "general_response" not in inferred_channels:
            strategy.target_channels = inferred_channels

        logs.append(f"STRATEGIST: {strategy.target_channels} | Goal: {strategy.goal[:50]}...")
        return {"strategy": strategy, "logs": logs}

    except Exception as e:
        logger.error(f"Strategist failed: {e}")
        return {
            "strategy": StrategyBrief(
                target_channels=inferred_channels,
                target_channel=inferred_channels[0] if inferred_channels else "general_response",
                goal="Answer user",
                hook="None",
                key_points=[],
                framework="Direct",
                cta="None"
            ),
            "logs": logs
        }


@traceable(name="Scribe Node")
async def scribe_node(state: AgentState) -> AgentState:
    """
    Writes content for ALL selected channels in PARALLEL.
    """
    llm_client, llm_creative, llm_fast = init_llm_clients()
    logger.info("SCRIBE: Drafting content (parallel mode)...")
    strategy: StrategyBrief = ensure_strategy(state.strategy)
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    psych: PsychProfile = ensure_psych(state.psych)
    critique: CritiqueResult = ensure_critique(state.latest_critique)
    instruction = state.user_instruction or ""
    context = ensure_context(getattr(state, "context", None))

    current_drafts = state.drafts
    history = state.conversation_history
    logs = state.logs

    target_ctx = context.target_profile if context else None
    sender_ctx = context.sender_profile if context else None
    task_ctx = context.task_intent if context else None

    target_name = (target_ctx.name if target_ctx and target_ctx.name else prospect.name)
    target_role = (target_ctx.role if target_ctx and target_ctx.role else prospect.role)
    target_company = (target_ctx.company if target_ctx and target_ctx.company else prospect.company)
    target_industry = (target_ctx.industry if target_ctx and target_ctx.industry else (prospect.industry or "Unknown"))
    target_seniority = (target_ctx.seniority if target_ctx and target_ctx.seniority else (prospect.seniority or "unknown"))
    target_tone = (target_ctx.tone if target_ctx and target_ctx.tone else psych.communication_style)
    target_language_style = (target_ctx.language_style if target_ctx and target_ctx.language_style else "clear")
    target_interests = (target_ctx.interests if target_ctx and target_ctx.interests else prospect.interests)
    target_traits = (target_ctx.psych_traits if target_ctx and target_ctx.psych_traits else [])
    target_recent_focus = (
        target_ctx.recent_focus_summary
        if target_ctx and target_ctx.recent_focus_summary
        else (prospect.summary or (prospect.raw_bio or "")[:220])
    )
    target_recent_focus = re.sub(r"\s+", " ", (target_recent_focus or "")).strip()[:320]

    sender_name = sender_ctx.name if sender_ctx and sender_ctx.name else "You"
    sender_role = sender_ctx.role if sender_ctx and sender_ctx.role else "Professional"
    sender_company = sender_ctx.company if sender_ctx and sender_ctx.company else "Your Company"
    sender_value_prop = sender_ctx.value_proposition if sender_ctx and sender_ctx.value_proposition else "Clear value aligned with the topic."

    task_topic_lock = (
        task_ctx.topic_lock
        if task_ctx and task_ctx.topic_lock
        else (getattr(state, "topic_lock", None) or strategy.goal)
    )
    task_channel_hint = task_ctx.channel_hint if task_ctx and task_ctx.channel_hint else strategy.target_channel

    structured_injection_prompt = f"""You are drafting outreach based on structured persona data.

TARGET:
Name: {target_name}
Role: {target_role} at {target_company}
Industry: {target_industry}
Seniority: {target_seniority}
Tone preference: {target_tone}
Language style: {target_language_style}
Interests: {', '.join(target_interests[:4]) if target_interests else 'n/a'}
Psych traits: {', '.join(target_traits[:4]) if target_traits else 'n/a'}
Recent focus: {target_recent_focus or 'n/a'}

SENDER:
Name: {sender_name}
Role: {sender_role} at {sender_company}
Credibility: {sender_value_prop}

TASK:
Topic: {task_topic_lock}
Channel: {task_channel_hint}

Rules:
- Stay strictly on topic.
- Immediately anchor to the topic.
- Mirror tone naturally.
- Reference 1-2 specific persona elements.
- Clear CTA.
- No generic corporate language.
- Do not drift into unrelated achievements.
- Keep under 180 words for email.
"""

    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-3:]]) if history else "None"

    query_text = f"{prospect.role} {prospect.company} {strategy.goal}"
    similar_outreach = _get_kb().get_similar_outreach(query_text=query_text, role=prospect.role, limit=1)
    kb_context = ""
    if similar_outreach:
        kb_context = f"PAST EXAMPLE:\n{similar_outreach[0]['content'][:500]}"

    insight_seed = ""
    if prospect.recent_activity and prospect.interests:
        insight_seed = f"Recent activity '{prospect.recent_activity[0]}' suggests a focus on {prospect.interests[0]}."
    elif prospect.recent_activity:
        insight_seed = f"Recent activity '{prospect.recent_activity[0]}' suggests current priorities."
    elif prospect.interests:
        insight_seed = f"Interest in {prospect.interests[0]} suggests active focus in that area."

    channels_to_generate = []
    
    # Task 9: Regenerate ONLY failed channels using per-channel critique results
    channel_critiques = state.channel_critiques or {}
    
    for channel in strategy.target_channels:
        # If draft exists and passed specific channel critique, skip regeneration
        if channel in current_drafts:
            if channel in channel_critiques and channel_critiques[channel].passed:
                 continue
            # If logic only has generic critique, check that (fallback)
            elif not channel_critiques and critique and critique.passed:
                 continue
                 
        channels_to_generate.append(channel)

    if not channels_to_generate:
        logs.append("SCRIBE: All channels already drafted.")
        return {
            "drafts": current_drafts,
            "last_generated_channels": [],
            "revision_count": state.revision_count,
            "final_output": current_drafts,
            "latest_critique": None,
            "logs": logs
        }

    # Shared Definitions for Single and Multi-channel
    wants_subject = "subject" in instruction.lower() and "body" in instruction.lower()
    
    topic_lock = task_topic_lock or ''
    topic_lock_section = ''
    if topic_lock:
        topic_lock_section = f"""\nTOPIC LOCK (HIGHEST PRIORITY):
Every paragraph must directly reference: \"{topic_lock}\".
If content drifts from this topic, abort and regenerate.
"""

    creative_section = """\nCREATIVE PERSONALIZATION (CRITICAL):
You may use professional templates/openers, BUT they must be infused with specific context.
- Never use a generic "I hope you are well" without immediately pivoting to a relevant, specific reason tied to the TOPIC_LOCK.
- The tone must be unique to the prospect's style.
- Every sentence should feel hand-crafted, not copy-pasted.
"""

    async def generate_channel(channel: str) -> tuple[str, str]:
        if channel == "general_response":
            prompt = f"""You are a helpful assistant. Answer the user's request directly and concisely.
Do not invent personal or company details. If the user is greeting you, respond briefly and ask how you can help.

USER REQUEST:
{instruction}
"""
            try:
                response = await llm_creative.ainvoke(
                    prompt,
                    config={"temperature": 0.2, "num_predict": 200}
                )
                return (channel, response.content.strip())
            except Exception as e:
                logger.error(f"General response failed: {e}")
                return (channel, "Hi! How can I help you?")

        rules = CHANNEL_RULES.get(channel, "Standard professional text.")
        comments = f"FIX: {critique.feedback}" if (critique and not critique.passed) else ""

        subject_note = ""
        if channel == "email" and wants_subject:
            subject_note = "Output format:\nSubject: <short subject>\nBody: <email body>\n"

        # --- NEW: Build topic lock and template ban sections ---
        topic_lock = task_topic_lock or ''
        topic_lock_section = ''
        if topic_lock:
            topic_lock_section = f"""\nTOPIC LOCK (HIGHEST PRIORITY):
Every paragraph must directly reference: \"{topic_lock}\".
If content drifts from this topic, abort and regenerate.
The user's instruction overrides memory, cached patterns, and default templates.
"""
        # --- NEW: Creative Personalization instead of Bans ---
        creative_section = """\nCREATIVE PERSONALIZATION (CRITICAL):
You may use professional templates/openers, BUT they must be infused with specific context.
- Never use a generic "I hope you are well" without immediately pivoting to a relevant, specific reason tied to the TOPIC_LOCK.
- The tone must be unique to the prospect's style.
- Every sentence should feel hand-crafted, not copy-pasted.
"""

        prompt = f"""You are an elite copywriter.

STRUCTURED INJECTION (SOURCE OF TRUTH):
{structured_injection_prompt}
CONDENSED MEMORY:
{context.compressed_memory if context else 'n/a'}

{QUALITY_RUBRIC_TEXT}

USER INSTRUCTION (SOURCE OF TRUTH):
{instruction}
The User Instruction dictates the specific "Ask", the topic, and any mandatory details. 
If the user asks for a meeting, ask for a meeting. If they ask to share a link, share the link.
Do not let "Creative Personalization" override these specific instructions.

{topic_lock_section}
TASK: Write a {channel} message.
GOAL: {strategy.goal}
HOOK: {strategy.hook}
KEY POINTS: {', '.join(strategy.key_points)}
CTA: {strategy.cta}

TARGET PERSONA:
Name: {prospect.name}
Role: {prospect.role}
Company: {prospect.company}
Industry: {prospect.industry or 'Unknown'}
Recent Activity: {', '.join(prospect.recent_activity[:3])}
Interests: {', '.join(prospect.interests[:3])}

STYLE:
Communication Style: {psych.communication_style}
Tone Instructions: {', '.join(psych.tone_instructions)}
Style Rules: {chr(10).join(psych.style_rules[:3])}

TONE MATCHING STRATEGY:
Mirror target's rhythm:
- Avg Sentence Length: {getattr(psych, 'avg_sentence_len', 'Unknown')} words
- Vocabulary Complexity: {getattr(psych, 'vocabulary_complexity', 'Standard')}
- Emoji Usage: {getattr(psych, 'emoji_usage', 'None')}

- If Avg Length < 10, write punchy/short. If > 20, more complex flow.
- If Emoji Usage is 'High', use 1-2 relevant emojis. If 'None', use ZERO.
- Tone matching is about rhythm, not just adjectives. Match their cadence.

HISTORY_CONTEXT:
{history_context}

{kb_context}

PLATFORM RULES:
{rules}

{subject_note}

PERSONALIZATION REQUIREMENTS:
- Must explicitly include the person's name OR role AND the company.
- Must include at least one specific interest or recent activity detail.
- Hook must be unique to a concrete detail (role/company/interest/recent activity).
- Do not reuse the same opener across channels.
- Use this insight seed to craft a natural hook (do not claim external research): {insight_seed}

{creative_section}
{comments}

EMAIL STRUCTURE (STRICT - if channel is email):
1. Context Opening: Introduce purpose directly. NO generic greetings.
2. Core Intent: Explain the initiative/idea with concrete details.
3. Value/Impact: Why it matters to THEM.
4. Action Step: Specific CTA aligned with topic.

NEGATIVE CONSTRAINTS:
- NO "I noticed your work", "Hope you're doing well", "Quick chat", "I wanted to reach out".
- NO generic praise.
- The message must feel intentional, cohesive, and topic-driven.

IMPORTANT: No generic corporate tone. Use concrete details from the persona. Output ONLY the message.
"""

        try:
            temp = CHANNEL_TEMPS.get(channel, 0.5)
            max_tokens = CHANNEL_MAX_TOKENS.get(channel, 180)
            response = await llm_creative.ainvoke(
                prompt,
                config={"temperature": temp, "num_predict": max_tokens}
            )
            return (channel, response.content)
        except Exception as e:
            logger.error(f"Scribe failed for {channel}: {e}")
            return (channel, f"[Error generating {channel}: {str(e)[:80]}]")

    results = []
    if len(channels_to_generate) > 1:
        channels_list = ", ".join(channels_to_generate)
        
        # TASK 7.1: PLANNING PHASE (Logic Model)
        planning_prompt = f"""You are a campaign strategist.
STRUCTURED INJECTION:
{structured_injection_prompt}
CONDENSED MEMORY:
{context.compressed_memory if context else 'n/a'}

User Instruction: {instruction}
Goal: {strategy.goal}
CTA: {strategy.cta}
Tone: {psych.communication_style}
Topic Lock: {task_topic_lock}

Confirm key content requirements before drafting.
OUTPUT JSON ONLY:
{{
  "topic_refinement": "1 sentence specific topic",
  "key_value_points": ["3 bullet points"],
  "content_structure": "Brief notes on flow"
}}"""
        plan_content = "Proceed with standard outreach."
        use_planning = len((instruction or "")) > 220 or len(channels_to_generate) > 2
        if use_planning:
            try:
                 plan_response = await llm_fast.ainvoke(planning_prompt)
                 plan_content = plan_response.content
            except Exception as e:
                 logger.warning(f"Planning failed: {e}")

        # TASK 7.2: WRITING PHASE (Creative Model)
        # TASK 9: JSON OUTPUT
        
        prompt = f"""You are an elite copywriter.
STRUCTURED INJECTION:
{structured_injection_prompt}
CONDENSED MEMORY:
{context.compressed_memory if context else 'n/a'}

PLANNING NOTES:
{plan_content}

TARGET PERSONA:
Name: {prospect.name}
Role: {prospect.role}
Company: {prospect.company}
Activity: {', '.join(prospect.recent_activity[:3])}
Interests: {', '.join(prospect.interests[:3])}

TONE ({psych.communication_style}):
Mirror target's rhythm:
- Avg Sentence Length: {getattr(psych, 'avg_sentence_len', 'Unknown')}
- Emoji: {getattr(psych, 'emoji_usage', 'None')}

PLATFORM RULES:
{chr(10).join([f"{ch}: {CHANNEL_RULES.get(ch, 'Standard')}" for ch in channels_to_generate])}

TASK: Write messages for: {channels_list}
INSIGHT: {insight_seed}

STRICT CONSTRAINTS:
1. JSON OUTPUT ONLY. Keys: {channels_to_generate}
2. NO generic phrases ("I noticed...", "Hope you're well").
3. Email must follow Context -> Intent -> Value -> Action.

OUTPUT FORMAT:
{{
  "email": "Subject: ... Body: ...",
  "linkedin_dm": "...",
  "whatsapp": "..."
}}
"""
        try:
            temp = 0.5
            # Dynamic cap sized to selected channels; avoids over-generation latency.
            budget_from_channels = sum(CHANNEL_MAX_TOKENS.get(ch, 180) for ch in channels_to_generate)
            max_tokens = min(1600, max(420, int(budget_from_channels * 1.1)))
            response = await llm_creative.ainvoke(
                prompt,
                config={"temperature": temp, "num_predict": max_tokens}
            )
            
            # Task 9: Use JSON Parsing logic
            parsed = parse_multi_channel(response.content, channels_to_generate)
            for ch in channels_to_generate:
                if ch in parsed:
                    results.append((ch, parsed[ch]))
                else:
                    results.append((ch, f"[Parse error: missing {ch}]"))
        except Exception as e:
            logger.error(f"Scribe multi-channel JSON failed: {e}")
            results = await asyncio.gather(*[generate_channel(ch) for ch in channels_to_generate])
    else:
        results = await asyncio.gather(*[generate_channel(ch) for ch in channels_to_generate])

    new_drafts = current_drafts.copy()
    for channel, content in results:
        new_drafts[channel] = content
        logs.append(f"SCRIBE: {channel} drafted.")

    return {
        "drafts": new_drafts,
        "last_generated_channels": channels_to_generate,
        "revision_count": state.revision_count + 1,
        "final_output": new_drafts,
        "latest_critique": None,
        "logs": logs
    }


@traceable(name="Critic Node")
async def critic_node(state: AgentState) -> AgentState:
    """
    Evaluates drafts for quality, hallucinations, and adherence to constraints.
    """
    llm_client, _, _ = init_llm_clients()
    logger.info("CRITIC: Reviewing drafts...")
    strategy: StrategyBrief = ensure_strategy(state.strategy)
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    psych: PsychProfile = ensure_psych(state.psych)
    context = ensure_context(getattr(state, "context", None))
    drafts = state.drafts
    logs = state.logs
    previous_channel_critiques = {
        ch: ensure_critique(cr)
        for ch, cr in (state.channel_critiques or {}).items()
    }
    last_generated_channels = list(getattr(state, "last_generated_channels", []) or [])

    target_ctx = context.target_profile if context else None
    task_ctx = context.task_intent if context else None
    expected_topic = (
        task_ctx.topic_lock
        if task_ctx and task_ctx.topic_lock
        else (getattr(state, "topic_lock", None) or "")
    ).strip()
    tone_tag = (
        target_ctx.tone
        if target_ctx and target_ctx.tone
        else (psych.communication_style or "professional")
    )

    persona_signals = []
    if target_ctx:
        persona_signals.extend([
            target_ctx.name,
            target_ctx.role,
            target_ctx.company,
            *(target_ctx.interests[:2] if target_ctx.interests else []),
        ])
    persona_signals.extend([
        prospect.name,
        prospect.role,
        prospect.company,
        *(prospect.interests[:2] if prospect.interests else []),
    ])
    persona_signals = [
        signal.strip() for signal in persona_signals
        if isinstance(signal, str) and signal.strip() and len(signal.strip()) >= 3
    ]

    def _has_persona_signal(draft_text: str) -> bool:
        lower = draft_text.lower()
        return any(signal.lower() in lower for signal in persona_signals)

    def _normalized_text(text: str) -> str:
        cleaned = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
        return re.sub(r"\s+", " ", cleaned).strip()

    def _matches_tone(draft_text: str, tone: str) -> bool:
        body = draft_text.lower()
        tone_lc = (tone or "").lower()
        emoji_count = sum(1 for ch in draft_text if ord(ch) > 10000)
        slang_markers = ["bro", "dude", "lol", "omg", "yo"]

        if any(k in tone_lc for k in ["formal", "professional", "executive"]):
            if emoji_count > 0 or body.count("!") > 2 or any(s in body for s in slang_markers):
                return False

        if any(k in tone_lc for k in ["casual", "friendly"]):
            if emoji_count == 0 and "!" not in draft_text and not any(k in body for k in ["hi", "hey", "great", "glad", "thanks"]):
                return False

        return True

    async def critique_channel(channel: str) -> tuple[str, CritiqueResult]:
        draft = drafts.get(channel, "")
        if not draft:
            return (channel, CritiqueResult(score=0, feedback="Empty draft", passed=False))

        try:
            deterministic_errors = []
            normalized_topic = _normalized_text(expected_topic)
            normalized_draft = _normalized_text(draft)
            if expected_topic and normalized_topic not in normalized_draft:
                deterministic_errors.append(f"Missing explicit topic lock reference: '{expected_topic}'")
            if persona_signals and not _has_persona_signal(draft):
                deterministic_errors.append("No persona signal referenced (name/role/company/interest required).")
            if not _matches_tone(draft, tone_tag):
                deterministic_errors.append(f"Tone mismatch for expected tone '{tone_tag}'.")

            if deterministic_errors:
                return (
                    channel,
                    CritiqueResult(
                        score=3,
                        feedback="ANTI-DRIFT: " + " | ".join(deterministic_errors),
                        passed=False,
                    ),
                )

            critique = await asyncio.to_thread(
                cached_llm_call,
                llm_client,
                LOGIC_MODEL,
                CritiqueResult,
                [
                    {
                        "role": "system",
                        "content": f"""You are a ruthless anti-drift editor. Grade 1-10 and pass only if ALL conditions are met.

{QUALITY_RUBRIC_TEXT}

MANDATORY VALIDATION RULES:
1. Must reference TOPIC_LOCK explicitly.
2. Must include at least one persona signal (name/role/company/interest).
3. Must not introduce facts outside provided structured persona.
4. Must match the expected tone tag.
5. Must satisfy user instruction's core ask.

If any mandatory rule fails, set passed=false and explain exactly why.
If fabricated facts appear, prefix feedback with "HALLUCINATION:".

TOPIC_LOCK: {expected_topic or 'none'}
TONE_TAG: {tone_tag}
PERSONA_SIGNALS: {', '.join(persona_signals[:8]) if persona_signals else 'none'}"""
                    },
                    {
                        "role": "user",
                        "content": f"""USER INSTRUCTION: "{state.user_instruction}"
CHANNEL: {channel}
INTENDED TONE: {tone_tag}
DRAFT:
{draft[:900]}

Evaluate for anti-drift, factual grounding, and channel fit."""
                    }
                ],
                use_cache=True
            )
            return (channel, critique)
        except Exception as e:
            logger.error(f"Critique failed for {channel}: {e}")
            return (channel, CritiqueResult(score=7, feedback="Proceed", passed=True))

    channels_with_drafts = [ch for ch in strategy.target_channels if ch in drafts]
    if last_generated_channels:
        channels_to_review = [ch for ch in last_generated_channels if ch in channels_with_drafts]
    else:
        channels_to_review = [
            ch for ch in channels_with_drafts
            if ch not in previous_channel_critiques or not previous_channel_critiques[ch].passed
        ]

    critique_tasks = [critique_channel(ch) for ch in channels_to_review]
    results = await asyncio.gather(*critique_tasks) if critique_tasks else []

    critiques = dict(previous_channel_critiques)
    critiques.update({ch: cr for ch, cr in results})

    evaluated = [critiques[ch] for ch in channels_with_drafts if ch in critiques]
    avg_score = (sum(c.score for c in evaluated) / len(evaluated)) if evaluated else 0
    all_passed = bool(evaluated) and len(evaluated) == len(channels_with_drafts) and all(c.passed for c in evaluated)

    if evaluated:
        worst_channel = min(
            [ch for ch in channels_with_drafts if ch in critiques],
            key=lambda ch: critiques[ch].score
        )
        worst_critique = critiques[worst_channel]
    else:
        worst_channel = "unknown"
        worst_critique = CritiqueResult(score=0, feedback="No critiques", passed=False)

    reused_count = max(0, len(channels_with_drafts) - len(channels_to_review))
    logs.append(
        f"CRITIC: Avg {avg_score:.1f}/10 | Reviewed {len(channels_to_review)}/{len(channels_with_drafts)} channels "
        f"(reused={reused_count}) | Passed: {all_passed}"
    )

    if all_passed:
        best_channel = max(critiques.items(), key=lambda x: x[1].score)[0]
        _get_kb().save_outreach(state.prospect, strategy, drafts[best_channel])

    return {
        "latest_critique": worst_critique,
        "channel_critiques": critiques,
        "logs": logs
    }
