import instructor
import asyncio
import re
import hashlib
import time
import os
from typing import Optional, Any, List, Dict
from langchain_ollama import ChatOllama
from loguru import logger
from langsmith import traceable
from ml.settings import settings
from .schemas import (
    AgentState, ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult, ChannelType
)
from .knowledge import SimpleKnowledgeBase
from .writing_style_inferrer import infer_style_rules
from agent_style_transfer.schemas import Document
from ..crawlers.dispatcher import CrawlerDispatcher
from .tools import duckduckgo_search
import openai

# --- Response Cache for LLM calls ---
class LLMCache:
    """Simple in-memory cache for LLM responses to reduce latency on similar requests."""
    def __init__(self, ttl_seconds: int = 300):
        self._cache = {}
        self._ttl = ttl_seconds

    def _make_key(self, model: str, response_model: Any, messages: list, **kwargs) -> str:
        key_data = f"{model}:{str(response_model.__name__ if hasattr(response_model, '__name__') else str(response_model))}:{str(messages)}:{str(sorted(kwargs.items()))}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:32]

    def get(self, model: str, response_model: Any, messages: list, **kwargs) -> Optional[Any]:
        key = self._make_key(model, response_model, messages, **kwargs)
        if key in self._cache:
            result, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                logger.debug(f"LLM Cache HIT for {response_model.__name__ if hasattr(response_model, '__name__') else 'unknown'}")
                return result
            del self._cache[key]
        return None

    def set(self, model: str, response_model: Any, messages: list, result: Any, **kwargs):
        key = self._make_key(model, response_model, messages, **kwargs)
        self._cache[key] = (result, time.time())
        if len(self._cache) > 1000:
            sorted_items = sorted(self._cache.items(), key=lambda x: x[1][1])
            for old_key, _ in sorted_items[:200]:
                del self._cache[old_key]

llm_cache = LLMCache(ttl_seconds=300)

def cached_llm_call(client, model: str, response_model: Any, messages: list, max_retries: int = 2, use_cache: bool = True):
    if use_cache:
        cached = llm_cache.get(model, response_model, messages, max_retries=max_retries)
        if cached is not None:
            return cached

    result = client.chat.completions.create(
        model=model,
        response_model=response_model,
        messages=messages,
        max_retries=max_retries
    )

    if use_cache:
        llm_cache.set(model, response_model, messages, result, max_retries=max_retries)

    return result

# --- Configuration ---
LOGIC_MODEL = settings.LLM_LOGIC_MODEL
CREATIVE_MODEL = settings.LLM_CREATIVE_MODEL
OFFLINE_STRICT = os.getenv("OFFLINE_STRICT", "true").lower() == "true"

CHANNEL_TEMPS = {
    "email": 0.6,
    "linkedin_dm": 0.5,
    "linkedin_post": 0.7,
    "whatsapp": 0.4,
    "sms": 0.3,
    "twitter_thread": 0.7,
    "general_response": 0.3,
    "instagram_dm": 0.5,
}

# --- Quality Baseline (Hard Constraints) ---
QUALITY_BASELINE = {
    "personalization_specificity": "Reference at least two of: name, role, company, interests, recent activity.",
    "correct_reference_usage": "Do not invent role/company/interests. Use only provided facts.",
    "tone_alignment": "Match inferred style and follow style rules.",
    "cta_clarity": "Single, clear CTA appropriate to channel."
}

QUALITY_RUBRIC_TEXT = (
    "QUALITY BASELINE (NON-NEGOTIABLE):\n"
    "- Personalization specificity: reference at least two of name/role/company/interests/activity.\n"
    "- Correct reference usage: no hallucinated role/company/interests.\n"
    "- Tone alignment: follow inferred style and style rules.\n"
    "- CTA clarity: one clear, channel-appropriate ask.\n"
)

# --- Deterministic Channel Detection (Avoid Unneeded LLM Calls) ---
def infer_channels_from_instruction(instruction: str) -> List[str]:
    instruction_lc = (instruction or "").lower()
    channels = []
    if "email" in instruction_lc or "cold email" in instruction_lc:
        channels.append("email")
    if "linkedin" in instruction_lc and ("dm" in instruction_lc or "message" in instruction_lc or "inmail" in instruction_lc):
        channels.append("linkedin_dm")
    if "linkedin" in instruction_lc and "post" in instruction_lc:
        channels.append("linkedin_post")
    if "whatsapp" in instruction_lc or "whats app" in instruction_lc:
        channels.append("whatsapp")
    if "sms" in instruction_lc or "text message" in instruction_lc:
        channels.append("sms")
    if "instagram" in instruction_lc or "ig dm" in instruction_lc:
        channels.append("instagram_dm")
    if "twitter" in instruction_lc or "x thread" in instruction_lc:
        channels.append("twitter_thread")
    return list(dict.fromkeys(channels))


def infer_seniority_from_role(role: str) -> Optional[str]:
    if not role:
        return None
    role_lc = role.lower()
    if any(k in role_lc for k in ["founder", "ceo", "cfo", "cto", "co-founder", "president"]):
        return "executive"
    if any(k in role_lc for k in ["vp", "vice president", "head of", "director"]):
        return "senior_leadership"
    if any(k in role_lc for k in ["lead", "principal", "staff", "senior"]):
        return "senior"
    if any(k in role_lc for k in ["junior", "associate", "intern", "student"]):
        return "junior"
    return "mid"


def infer_style_signals(text: str) -> Dict[str, Any]:
    if not text:
        return {
            "emoji_count": 0,
            "exclamation_count": 0,
            "question_count": 0,
            "avg_sentence_len": 0,
            "style_hint": "professional"
        }
    emoji_count = sum(1 for ch in text if ord(ch) > 10000)
    exclamation_count = text.count("!")
    question_count = text.count("?")
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    avg_sentence_len = int(sum(len(s.split()) for s in sentences) / max(1, len(sentences)))
    style_hint = "professional"
    if emoji_count > 2 or exclamation_count > 3:
        style_hint = "casual"
    if avg_sentence_len <= 10:
        style_hint = "concise"
    return {
        "emoji_count": emoji_count,
        "exclamation_count": exclamation_count,
        "question_count": question_count,
        "avg_sentence_len": avg_sentence_len,
        "style_hint": style_hint
    }


def _extract_label(text: str, label: str) -> Optional[str]:
    pattern = rf"{label}\s*:\s*([^\n]+)"
    m = re.search(pattern, text, flags=re.IGNORECASE)
    return m.group(1).strip() if m else None


def _split_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[;,|/]+", value)
    return [p.strip() for p in parts if p.strip()]


def parse_profile_notes(text: str) -> Optional[ProspectProfile]:
    if not text:
        return None
    name = _extract_label(text, "Name")
    role = _extract_label(text, "Role")
    company = _extract_label(text, "Company")
    if not (name and role and company):
        return None

    industry = _extract_label(text, "Industry")
    location = _extract_label(text, "Location")
    interests = _split_list(_extract_label(text, "Interests"))
    recent = _split_list(_extract_label(text, "Recent"))
    language = _extract_label(text, "Language")
    summary = _extract_label(text, "About") or _extract_label(text, "Bio") or _extract_label(text, "Summary")

    profile = ProspectProfile(
        name=name,
        role=role,
        company=company,
        industry=industry,
        location=location,
        interests=interests,
        recent_activity=recent,
        primary_language=language,
        summary=summary,
        raw_bio=text
    )
    profile.seniority = infer_seniority_from_role(role)
    return profile


def extract_tone_from_text(text: str) -> Optional[str]:
    if not text:
        return None
    for label in ["tone", "style"]:
        val = _extract_label(text, label)
        if val:
            return val.lower()
    return None


def ensure_prospect(value: Any) -> ProspectProfile:
    if isinstance(value, ProspectProfile):
        return value
    if isinstance(value, dict):
        return ProspectProfile(**value)
    return value


def ensure_psych(value: Any) -> PsychProfile:
    if isinstance(value, PsychProfile):
        return value
    if isinstance(value, dict):
        return PsychProfile(**value)
    return value


def ensure_strategy(value: Any) -> StrategyBrief:
    if isinstance(value, StrategyBrief):
        return value
    if isinstance(value, dict):
        return StrategyBrief(**value)
    return value


def ensure_critique(value: Any) -> CritiqueResult:
    if isinstance(value, CritiqueResult):
        return value
    if isinstance(value, dict):
        return CritiqueResult(**value)
    return value

# Initialize Knowledge Base
kb = SimpleKnowledgeBase()

# Setup Structured LLM Clients (lazy init)
llm_client = None
llm_creative = None
llm_fast = None


def init_llm_clients():
    global llm_client, llm_creative, llm_fast
    if llm_client is None:
        try:
            llm_client = instructor.from_openai(
                openai.OpenAI(
                    base_url="http://localhost:11434/v1",
                    api_key="ollama",
                ),
                mode=instructor.Mode.JSON,
            )
            llm_creative = ChatOllama(model=CREATIVE_MODEL, temperature=0.7, num_ctx=1024)
            llm_fast = ChatOllama(model=LOGIC_MODEL, temperature=0.3, num_ctx=2048)
            logger.info("LLM clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM clients: {e}. Ensure Ollama is running.")
            raise
    return llm_client, llm_creative, llm_fast

# --- Node 1: HUNTER (Smart - KB First, then Scrape) ---
@traceable(name="Hunter Node")
async def hunter_node(state: AgentState) -> AgentState:
    init_llm_clients()
    logger.info("HUNTER: Checking inputs...")
    logs = state.logs
    logs.append("HUNTER: Starting research phase...")
    url = state.target_url
    instruction = state.user_instruction

    url_pattern = r'https?://[^\s]+'
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

    # 1. Check for valid URL
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
                            "content": f"""Extract schema from this data:

{notes_text}"""
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
                        "content": f"""Extract schema from these search results:

{search_results}"""
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

    # 2. Check Knowledge Base
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
                    "content": f"""Extract schema from this text:

{truncated_text}"""
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

# --- Node 2: PROFILER (Async with integrated style inference) ---
@traceable(name="Profiler Node")
async def profiler_node(state: AgentState) -> AgentState:
    """
    Analyzes personality & style with integrated style rule extraction.
    Single LLM call for both DISC analysis AND style rules.
    """
    init_llm_clients()
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
                    "content": f"""Analyze this writing and extract personality + style patterns:

TEXT:
{bio_excerpt}

STYLE SIGNALS (heuristic):
- emoji_count: {style_signals['emoji_count']}
- exclamation_count: {style_signals['exclamation_count']}
- question_count: {style_signals['question_count']}
- avg_sentence_len: {style_signals['avg_sentence_len']}
- style_hint: {style_signals['style_hint']}
"""
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

# --- Node 3: THE STRATEGIST (Async Multi-Channel Logic) ---
@traceable(name="Strategist Node")
async def strategist_node(state: AgentState) -> AgentState:
    """
    Decides the Channel(s) based on user instruction - now async with caching.
    """
    init_llm_clients()
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
        inferred_channels = ["email", "whatsapp", "linkedin_dm", "instagram_dm"]

    # Fast-path deterministic strategy when channels are explicit
    if inferred_channels and any(k in (instruction or "").lower() for k in ["generate", "create", "write", "draft"]):
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
                    "content": f"""INSTRUCTION: \"{instruction[:600]}\"
TARGET: {prospect.role} at {prospect.company}
STYLE: {psych.communication_style if psych else 'Unknown'}
HISTORY: {history_context[:400]}
CHANNEL_HINTS: {', '.join(inferred_channels)}

Create a StrategyBrief."""
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

# --- Node 4: THE SCRIBE (Parallel Channel Generation) ---
@traceable(name="Scribe Node")
async def scribe_node(state: AgentState) -> AgentState:
    """
    Writes content for ALL selected channels in PARALLEL.
    """
    init_llm_clients()
    logger.info("SCRIBE: Drafting content (parallel mode)...")
    strategy: StrategyBrief = ensure_strategy(state.strategy)
    prospect: ProspectProfile = ensure_prospect(state.prospect)
    psych: PsychProfile = ensure_psych(state.psych)
    critique: CritiqueResult = ensure_critique(state.latest_critique)

    current_drafts = state.drafts
    history = state.conversation_history
    logs = state.logs

    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-3:]]) if history else "None"

    query_text = f"{prospect.role} {prospect.company} {strategy.goal}"
    similar_outreach = kb.get_similar_outreach(query_text=query_text, role=prospect.role, limit=1)
    kb_context = ""
    if similar_outreach:
        kb_context = f"PAST EXAMPLE:\n{similar_outreach[0]['content'][:500]}"

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

    CHANNEL_RULES = {
        "email": "Subject line required. 3-7 words, attention-grabbing, specific. <=120 words. Professional but warm. Personalize with recipient details.",
        "linkedin_dm": "No subject. Conversational. 2 sentences max. Ask a question.",
        "linkedin_post": "Hook + insight + CTA. Use 2-3 hashtags. Keep concise.",
        "whatsapp": "<40 words. Casual, emoji-friendly. Direct ask.",
        "sms": "<120 chars. Ultra-concise. Clear CTA.",
        "twitter_thread": "Hook tweet + 1-2 value tweets + CTA tweet. Punchy.",
        "instagram_dm": "Friendly, visual language. 2 sentences max.",
        "general_response": "Clear, helpful answer. Markdown OK."
    }

    CHANNEL_MAX_TOKENS = {
        "email": 220,
        "linkedin_dm": 120,
        "linkedin_post": 220,
        "whatsapp": 90,
        "sms": 60,
        "twitter_thread": 220,
        "instagram_dm": 120,
        "general_response": 200,
    }

    async def generate_channel(channel: str) -> tuple[str, str]:
        rules = CHANNEL_RULES.get(channel, "Standard professional text.")
        comments = f"FIX: {critique.feedback}" if (critique and not critique.passed) else ""

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

    def _parse_multi_channel(text: str, channels: List[str]) -> Dict[str, str]:
        results = {}
        for ch in channels:
            pattern = rf"===CHANNEL:\s*{re.escape(ch)}===\\s*(.*?)(?:(?:\\n===CHANNEL:)|\\Z)"
            m = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
            if m:
                results[ch] = m.group(1).strip()
        return results

    results = []
    if len(channels_to_generate) > 1:
        channels_list = ", ".join(channels_to_generate)
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

IMPORTANT:
- No generic corporate tone.
- Use concrete details from the persona.
- Keep each channel within its length limits; shorter is better than longer.
- Prefer 1–2 short sentences for DMs and 3 short paragraphs max for email.
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
            parsed = _parse_multi_channel(response.content, channels_to_generate)
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

# --- Node 5: THE CRITIC (Multi-Channel Aware) ---
@traceable(name="Critic Node")
async def critic_node(state: AgentState) -> AgentState:
    """
    Evaluates ALL drafts in parallel for quality.
    """
    init_llm_clients()
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
                        "content": f"""CHANNEL: {channel}
INTENDED TONE: {psych.communication_style}
DRAFT:
{draft[:700]}

Evaluate: channel fit, tone match, personalization depth, CTA clarity, non-generic language."""
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
