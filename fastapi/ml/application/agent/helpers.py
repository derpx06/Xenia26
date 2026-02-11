import hashlib
import re
import time
import json
from typing import Optional, Any, List, Dict

import instructor
import openai
from langchain_ollama import ChatOllama
from loguru import logger

from .schemas import ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult
from .config import LOGIC_MODEL, CREATIVE_MODEL


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
    
    # Generic outreach intent? Suggest email + linkedin_dm + whatsapp as smart defaults
    # Broadened scope: any "write/draft" intent should trigger at least email/linkedin/whatsapp
    if not channels and any(k in instruction_lc for k in [
        "reach out", "contact", "message", "write", "draft", "create", 
        "generate", "compose", "send", "outreach"
    ]):
        channels.extend(["email", "whatsapp"])

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


def _extract_any_label(text: str, labels: List[str]) -> Optional[str]:
    for label in labels:
        val = _extract_label(text, label)
        if val:
            return val
    return None


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


def parse_structured_lead_data(text: str) -> Optional[ProspectProfile]:
    """
    Parse structured outreach briefs like:
    Person Name: ...
    Current Role: ...
    Company: ...
    Company Domain: ...
    Experience Level: ...
    Public Profile Signals:
    - ...
    """
    if not text:
        return None
    text_lc = text.lower()
    if "person name:" not in text_lc and "current role:" not in text_lc and "company:" not in text_lc:
        return None

    name = _extract_any_label(text, ["Person Name", "Name"])
    role = _extract_any_label(text, ["Current Role", "Role", "Title"])
    company = _extract_any_label(text, ["Company", "Company Name"])
    if not (name and role and company):
        return None

    industry = _extract_any_label(text, ["Company Domain", "Industry", "Domain"])
    experience = _extract_any_label(text, ["Experience Level", "Experience"])
    style = _extract_any_label(text, ["Writing Style", "Tone", "Style"])

    signals_section = ""
    if "public profile signals:" in text_lc:
        parts = re.split(r"public profile signals:\s*", text, flags=re.IGNORECASE)
        if len(parts) > 1:
            signals_section = parts[1]

    bullets = []
    if signals_section:
        for line in signals_section.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("=") or line.lower().startswith("objective") or line.lower().startswith("email requirements") or line.lower().startswith("output format"):
                break
            if line.startswith("-"):
                bullets.append(line.lstrip("-").strip())

    interests = []
    recent = []
    known_tags = [
        ("python", "Python"),
        ("backend", "backend systems"),
        ("api", "APIs"),
        ("distributed", "distributed systems"),
        ("performance", "performance optimization"),
        ("scalability", "scalable systems"),
        ("payments", "payments"),
        ("lending", "lending"),
        ("fintech", "FinTech"),
    ]

    for b in bullets:
        b_lc = b.lower()
        if "recent" in b_lc or "shared a post" in b_lc or "recently" in b_lc:
            recent.append(b)
        for key, tag in known_tags:
            if key in b_lc and tag not in interests:
                interests.append(tag)

    summary_parts = []
    if experience:
        summary_parts.append(f"Experience: {experience}")
    if style:
        summary_parts.append(f"Style: {style}")
    if bullets:
        summary_parts.append("Signals: " + "; ".join(bullets))
    summary = " | ".join(summary_parts) if summary_parts else None

    raw_bio_parts = [
        f"Name: {name}",
        f"Role: {role}",
        f"Company: {company}",
    ]
    if industry:
        raw_bio_parts.append(f"Industry: {industry}")
    if experience:
        raw_bio_parts.append(f"Experience: {experience}")
    if style:
        raw_bio_parts.append(f"Tone: {style}")
    if bullets:
        raw_bio_parts.append("Signals: " + "; ".join(bullets))

    profile = ProspectProfile(
        name=name,
        role=role,
        company=company,
        industry=industry,
        interests=interests,
        recent_activity=recent,
        summary=summary,
        raw_bio="\n".join(raw_bio_parts)
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


def parse_multi_channel(text: str, channels: List[str]) -> Dict[str, str]:
    if not text:
        return {}

    # Task 9: Try JSON parsing first for strict output
    try:
        clean_text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        if isinstance(data, dict):
            # Normalize keys to match channels (e.g. "email" -> "email")
            # Filter solely for requested channels to avoid noise
            results = {}
            for ch in channels:
                if ch in data:
                    val = data[ch]
                    # Handle nested dict output (LLM deviation)
                    if isinstance(val, dict):
                        subject = val.get("subject", "") or val.get("Subject", "")
                        body = val.get("body", "") or val.get("Body", "") or val.get("message", "")
                        if subject:
                            results[ch] = f"Subject: {subject}\n\n{body}"
                        else:
                            results[ch] = str(body) if body else str(val)
                    else:
                        results[ch] = str(val).strip()
            return results
    except json.JSONDecodeError:
        pass

    # Fallback to Regex Parsing (Legacy)
    results = {}
    for ch in channels:
        pattern = rf"===CHANNEL:\s*{re.escape(ch)}===\s*(.*?)(?:(?:\n===CHANNEL:)|\Z)"
        m = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
        if m:
            results[ch] = m.group(1).strip()
    return results
