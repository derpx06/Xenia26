import asyncio
import re

from loguru import logger
from langsmith import traceable

from .schemas import AgentState, ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult
from .knowledge import SimpleKnowledgeBase
from ..crawlers.dispatcher import CrawlerDispatcher
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
    parse_multi_channel,
)

kb = SimpleKnowledgeBase()


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
        kb.save_prospect(structured)
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
                kb.save_prospect(parsed)
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
                kb.save_prospect(profile)
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

        logs.append("HUNTER: No valid URL provided. Switching to Search Mode.")
        search_query = instruction

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
                    name="User", role="General", company="General", raw_bio=""
                ),
                "logs": logs
            }

    try:
        combined_texts = []
        if notes_text:
            combined_texts.append(notes_text)
        for src in source_urls:
            logs.append(f"HUNTER: Analyzing {src}...")
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

        kb.save_prospect(profile)

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

    cached = kb.get_psych_profile(prospect.name, prospect.company)
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
                style_rules=heuristic_rules[:3]
            )
            kb.save_psych_profile(prospect.name, prospect.company, profile)
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
                style_rules=heuristic_rules[:3]
            )
            kb.save_psych_profile(prospect.name, prospect.company, profile)
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
            use_cache=True
        )

        if not profile.style_rules:
            heuristic_rules = []
            if style_signals["emoji_count"] > 0:
                heuristic_rules.append("Allow light emoji usage when appropriate")
            if style_signals["avg_sentence_len"] <= 10:
                heuristic_rules.append("Use short sentences")
            if style_signals["style_hint"] == "casual":
                heuristic_rules.append("Use casual, friendly tone")
            profile.style_rules = heuristic_rules[:3]

        kb.save_psych_profile(prospect.name, prospect.company, profile)

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
    logs = state.logs

    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-2:]]) if history else "No history."

    inferred_channels = infer_channels_from_instruction(instruction)
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
        key_points = []
        if prospect.recent_activity:
            key_points.append(prospect.recent_activity[0])
        if prospect.interests:
            key_points.append(prospect.interests[0])
        hook = f"Noticed your work in {prospect.industry or prospect.role}" if (prospect.industry or prospect.role) else "Noticed your recent work"
        strategy = StrategyBrief(
            target_channels=inferred_channels,
            target_channel=inferred_channels[0],
            goal="Start a conversation",
            hook=hook,
            key_points=key_points[:3],
            framework="Direct",
            cta="Open to a quick 15-minute chat this week?"
        )
        logs.append(f"STRATEGIST: Fast-path strategy for {strategy.target_channels}.")
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

Channels: email (formal), linkedin_dm (professional networking), whatsapp/sms (casual), instagram_dm (social), linkedin_post (public), twitter_thread (viral), general_response (Q&A).

Return target_channels[], goal, hook, 2-3 key_points, framework, and cta.
Use the provided channel hints unless they conflict with instruction."""
                },
                {
                    "role": "user",
                    "content": f"""INSTRUCTION: "{instruction[:600]}"\nTARGET: {prospect.role} at {prospect.company}\nSTYLE: {psych.communication_style if psych else 'Unknown'}\nHISTORY: {history_context[:400]}\nCHANNEL_HINTS: {', '.join(inferred_channels)}\n\nCreate a StrategyBrief."""
                }
            ],
            use_cache=True
        )

        if not strategy.target_channels:
            strategy.target_channels = inferred_channels
        if inferred_channels:
            intersect = [c for c in strategy.target_channels if c in inferred_channels]
            strategy.target_channels = intersect or inferred_channels

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
    _, llm_creative, _ = init_llm_clients()
    logger.info("SCRIBE: Drafting content (parallel mode)...")
    strategy: StrategyBrief = ensure_strategy(state.strategy)
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    psych: PsychProfile = ensure_psych(state.psych)
    critique: CritiqueResult = ensure_critique(state.latest_critique)
    instruction = state.user_instruction or ""

    current_drafts = state.drafts
    history = state.conversation_history
    logs = state.logs

    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-3:]]) if history else "None"

    query_text = f"{prospect.role} {prospect.company} {strategy.goal}"
    similar_outreach = kb.get_similar_outreach(query_text=query_text, role=prospect.role, limit=1)
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
    for channel in strategy.target_channels:
        if channel in current_drafts and critique and critique.passed:
            continue
        channels_to_generate.append(channel)

    if not channels_to_generate:
        logs.append("SCRIBE: All channels already drafted.")
        return {
            "drafts": current_drafts,
            "revision_count": state.revision_count,
            "final_output": current_drafts,
            "latest_critique": None,
            "logs": logs
        }

    wants_subject = "subject" in instruction.lower() and "body" in instruction.lower()

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

        prompt = f"""You are an elite copywriter.

{QUALITY_RUBRIC_TEXT}

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

HISTORY_CONTEXT:
{history_context}

{kb_context}

PLATFORM RULES:
{rules}

{subject_note}

PERSONALIZATION REQUIREMENTS:
- Must explicitly include the person's name OR role AND the company.
- Must include at least one specific interest or recent activity detail.
- Do not add labels like "Recent Activity:" or "Interests:".
- Avoid generic openings (e.g., "Hope you're well", "Just reaching out").
- Hook must be unique to a concrete detail (role/company/interest/recent activity).
- Do not reuse the same opener across channels.
- Use this insight seed to craft a natural hook (do not claim external research): {insight_seed}

{comments}

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
        subject_note = ""
        if "email" in channels_to_generate and wants_subject:
            subject_note = "For the email channel, include a 'Subject:' line followed by 'Body:' and the email body."
        prompt = f"""You are an elite copywriter.

{QUALITY_RUBRIC_TEXT}

TASK: Write outreach messages for these channels: {channels_list}

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

STRATEGY:
Goal: {strategy.goal}
Hook: {strategy.hook}
Key Points: {', '.join(strategy.key_points)}
CTA: {strategy.cta}

HISTORY_CONTEXT:
{history_context}

{kb_context}

PLATFORM RULES:
{chr(10).join([f"{ch}: {CHANNEL_RULES.get(ch, 'Standard professional text.')}" for ch in channels_to_generate])}

{subject_note}

PERSONALIZATION REQUIREMENTS (apply to each channel):
- Must explicitly include the person's name OR role AND the company.
- Must include at least one specific interest or recent activity detail.
- Do not add labels like "Recent Activity:" or "Interests:".
- Avoid generic openings (e.g., "Hope you're well", "Just reaching out").
- Hook must be unique to a concrete detail (role/company/interest/recent activity).
- Do not reuse the same opener across channels.
- Use this insight seed to craft a natural hook (do not claim external research): {insight_seed}

IMPORTANT:
- No generic corporate tone.
- Use concrete details from the persona.
- Keep each channel within its length limits; shorter is better than longer.
- Prefer 1-2 short sentences for DMs and 3 short paragraphs max for email.
- Output ALL channels in the exact format below:

===CHANNEL: email===
[message]
===CHANNEL: linkedin_dm===
[message]
===CHANNEL: whatsapp===
[message]
===CHANNEL: sms===
[message]
===CHANNEL: instagram_dm===
[message]

Only include channels requested. Do not add extra text.
"""
        try:
            max_tokens = min(240, 80 * len(channels_to_generate))
            response = await llm_creative.ainvoke(
                prompt,
                config={"temperature": 0.3, "num_predict": max_tokens}
            )
            parsed = parse_multi_channel(response.content, channels_to_generate)
            for ch in channels_to_generate:
                if ch in parsed:
                    results.append((ch, parsed[ch]))
                else:
                    results.append((ch, f"[Parse error: missing {ch}]"))
        except Exception as e:
            logger.error(f"Scribe multi-channel failed: {e}")
            results = await asyncio.gather(*[generate_channel(ch) for ch in channels_to_generate])
    else:
        results = await asyncio.gather(*[generate_channel(ch) for ch in channels_to_generate])

    new_drafts = current_drafts.copy()
    for channel, content in results:
        new_drafts[channel] = content
        logs.append(f"SCRIBE: {channel} drafted.")

    return {
        "drafts": new_drafts,
        "revision_count": state.revision_count + 1,
        "final_output": new_drafts,
        "latest_critique": None,
        "logs": logs
    }


@traceable(name="Critic Node")
async def critic_node(state: AgentState) -> AgentState:
    """
    Evaluates ALL drafts in parallel for quality.
    """
    llm_client, _, _ = init_llm_clients()
    logger.info("CRITIC: Judging work...")
    strategy = ensure_strategy(state.strategy)
    drafts = state.drafts
    psych: PsychProfile = ensure_psych(state.psych)
    logs = state.logs

    if "general_response" in strategy.target_channels and len(strategy.target_channels) == 1:
        logs.append("CRITIC: General response auto-approved.")
        return {
            "latest_critique": CritiqueResult(score=10, feedback="Pass", passed=True),
            "logs": logs
        }

    async def critique_channel(channel: str) -> tuple[str, CritiqueResult]:
        draft = drafts.get(channel, "")
        if not draft:
            return (channel, CritiqueResult(score=0, feedback="Empty draft", passed=False))

        try:
            critique = await asyncio.to_thread(
                cached_llm_call,
                llm_client,
                LOGIC_MODEL,
                CritiqueResult,
                [
                    {
                        "role": "system",
                        "content": f"""You are a ruthless editor. Grade 1-10 and mark passed only if the draft satisfies:\n{QUALITY_RUBRIC_TEXT}"""
                    },
                    {
                        "role": "user",
                        "content": f"""CHANNEL: {channel}\nINTENDED TONE: {psych.communication_style}\nDRAFT:\n{draft[:700]}\n\nEvaluate: channel fit, tone match, personalization depth, CTA clarity, non-generic language. Penalize generic openings or repeated hooks."""
                    }
                ],
                use_cache=False
            )
            return (channel, critique)
        except Exception as e:
            logger.error(f"Critique failed for {channel}: {e}")
            return (channel, CritiqueResult(score=7, feedback="Proceed", passed=True))

    critique_tasks = [critique_channel(ch) for ch in strategy.target_channels if ch in drafts]
    results = await asyncio.gather(*critique_tasks)

    critiques = {ch: cr for ch, cr in results}
    avg_score = sum(c.score for c in critiques.values()) / len(critiques) if critiques else 0
    all_passed = all(c.passed for c in critiques.values())

    worst_channel = min(critiques.items(), key=lambda x: x[1].score)[0] if critiques else "unknown"
    worst_critique = critiques[worst_channel] if critiques else CritiqueResult(score=0, feedback="No critiques", passed=False)

    logs.append(f"CRITIC: Avg {avg_score:.1f}/10 | {len(critiques)} channels | Passed: {all_passed}")

    if all_passed:
        best_channel = max(critiques.items(), key=lambda x: x[1].score)[0]
        kb.save_outreach(state.prospect, strategy, drafts[best_channel])

    return {
        "latest_critique": worst_critique,
        "logs": logs
    }
