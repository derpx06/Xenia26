import asyncio
import re
import time
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

try:
    from bson import ObjectId
except Exception:
    ObjectId = None

try:
    from ml.infrastructure.db.mongo import connection
except Exception:
    connection = None
from ml.settings import settings

from .helpers import infer_channels_from_instruction, infer_seniority_from_role
from .schemas import (
    ContextInjection,
    MentionSenderProfile,
    MentionTargetProfile,
    MentionTaskIntent,
    ProspectProfile,
    PsychProfile,
)


MENTION_RE = re.compile(
    r"(?<!\S)@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?)"
)
MAX_INJECTION_TOKENS = 260
_CONTEXT_CACHE_TTL_SECONDS = 120
_context_cache: Dict[str, Tuple[float, ContextInjection]] = {}


def _truncate_words(text: str, limit: int) -> str:
    words = [w for w in (text or "").split() if w]
    if len(words) <= limit:
        return " ".join(words)
    return " ".join(words[:limit])


def _clip_list(values: List[str], max_items: int = 5) -> List[str]:
    cleaned: List[str] = []
    seen = set()
    for item in values:
        norm = (item or "").strip()
        if not norm:
            continue
        key = norm.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(norm)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _extract_mentions(text: str) -> List[str]:
    mentions = []
    seen = set()
    for token in MENTION_RE.findall(text or ""):
        cleaned = token.strip(".,!?;:").strip().lower()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            mentions.append(cleaned)
    return mentions


def _uri_db_name(uri: str) -> Optional[str]:
    try:
        parsed = urlparse(uri)
        path = (parsed.path or "").strip("/")
        return path or None
    except Exception:
        return None


@lru_cache(maxsize=1)
def _resolve_db_name() -> Optional[str]:
    if connection is None:
        return None
    client = getattr(connection, "_client", None)
    if client is None:
        return None

    candidates = []
    env_name = (settings.DATABASE_NAME or "").strip()
    uri_name = _uri_db_name(settings.MONGO_URI or "")
    if env_name:
        candidates.append(env_name)
    if uri_name:
        candidates.append(uri_name)
    candidates.extend(["test", "xenia26"])

    deduped = []
    seen = set()
    for name in candidates:
        if name and name not in seen:
            seen.add(name)
            deduped.append(name)

    for name in deduped:
        try:
            cols = set(client[name].list_collection_names())
            if "users" in cols and "contacts" in cols:
                return name
        except Exception:
            continue

    for name in deduped:
        try:
            _ = client[name].name
            return name
        except Exception:
            continue

    try:
        for name in client.list_database_names():
            cols = set(client[name].list_collection_names())
            if "users" in cols and "contacts" in cols:
                return name
    except Exception:
        pass

    return None


def _get_collections():
    if connection is None:
        return None, None
    db_name = _resolve_db_name()
    if not db_name:
        return None, None
    db = connection.get_database(db_name)
    if db is None:
        return None, None
    return db["users"], db["contacts"]


def _sender_doc_for_email(user_email: str) -> Optional[Dict[str, Any]]:
    users_col, _ = _get_collections()
    if users_col is None or not user_email:
        return None
    return users_col.find_one(
        {"email": user_email.strip().lower()},
        {
            "_id": 1,
            "name": 1,
            "email": 1,
            "role": 1,
            "company": 1,
            "bio": 1,
            "website": 1,
            "socials": 1,
        },
    )


def _query_target_contact(user_email: str, mention_tokens: List[str]) -> Optional[Dict[str, Any]]:
    users_col, contacts_col = _get_collections()
    if users_col is None or contacts_col is None:
        return None
    if not user_email or not mention_tokens:
        return None

    sender = users_col.find_one(
        {"email": user_email.strip().lower()},
        {"_id": 1},
    )
    if not sender:
        return None

    query_terms: List[Dict[str, Any]] = []
    for token in mention_tokens:
        escaped = re.escape(token)
        query_terms.extend(
            [
                {"name": {"$regex": f"^{escaped}", "$options": "i"}},
                {"email": {"$regex": f"^{escaped}", "$options": "i"}},
                {"linkedinUrl": {"$regex": escaped, "$options": "i"}},
            ]
        )
        if ObjectId and re.fullmatch(r"[0-9a-fA-F]{24}", token):
            try:
                query_terms.append({"_id": ObjectId(token)})
            except Exception:
                pass

    if not query_terms:
        return None

    scoped_query = {
        "userId": sender["_id"],
        "$or": query_terms,
    }
    return contacts_col.find_one(
        scoped_query,
        {
            "name": 1,
            "email": 1,
            "phone": 1,
            "role": 1,
            "company": 1,
            "linkedinUrl": 1,
            "notes": 1,
            "updatedAt": 1,
        },
        sort=[("updatedAt", -1)],
    )


def _infer_tone_language_traits(text: str) -> Tuple[str, str, List[str]]:
    body = (text or "").lower()

    tone = "professional"
    if any(k in body for k in ["casual", "friendly", "slang", "informal"]):
        tone = "casual"
    elif any(k in body for k in ["formal", "executive", "precise"]):
        tone = "formal"

    language_style = "clear"
    if any(k in body for k in ["technical", "devops", "engineering", "architecture", "api"]):
        language_style = "technical"
    elif any(k in body for k in ["brief", "short", "concise", "direct"]):
        language_style = "concise"

    traits = []
    trait_map = [
        ("analytical", ["data", "technical", "architecture", "system", "engineering"]),
        ("decisive", ["ceo", "founder", "director", "head", "decision"]),
        ("collaborative", ["team", "collaborat", "partner", "cross-functional"]),
        ("social", ["friendly", "community", "networking", "relationship"]),
        ("detail_oriented", ["detail", "precision", "quality", "compliance"]),
    ]
    for tag, keywords in trait_map:
        if any(k in body for k in keywords):
            traits.append(tag)

    return tone, language_style, _clip_list(traits, 4)


def _extract_interests(notes: str) -> List[str]:
    if not notes:
        return []

    interests: List[str] = []
    for pattern in [
        r"interests?\s*:\s*([^\n]+)",
        r"focus(?:ed)?\s+on\s+([^\n.]+)",
        r"working\s+on\s+([^\n.]+)",
    ]:
        for match in re.findall(pattern, notes, flags=re.IGNORECASE):
            pieces = re.split(r"[;,|/]", match)
            interests.extend(piece.strip() for piece in pieces if piece.strip())

    keyword_tags = [
        ("ai", "AI"),
        ("ml", "Machine Learning"),
        ("devops", "DevOps"),
        ("automation", "Automation"),
        ("sales", "Sales"),
        ("partnership", "Partnerships"),
        ("growth", "Growth"),
        ("security", "Security"),
        ("cloud", "Cloud"),
    ]
    notes_lc = notes.lower()
    for key, label in keyword_tags:
        if key in notes_lc:
            interests.append(label)

    return _clip_list(interests, 5)


def _compact_summary(text: str, max_words: int) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    return _truncate_words(cleaned, max_words)


def _extract_target_profile(contact_doc: Optional[Dict[str, Any]], mention_tokens: List[str]) -> MentionTargetProfile:
    if not contact_doc:
        fallback = mention_tokens[0] if mention_tokens else ""
        return MentionTargetProfile(name=fallback)

    notes = (contact_doc.get("notes") or "").strip()
    tone, language_style, traits = _infer_tone_language_traits(notes)
    interests = _extract_interests(notes)
    summary_source = notes or f"{contact_doc.get('role', '')} at {contact_doc.get('company', '')}".strip()

    role = (contact_doc.get("role") or "").strip()
    return MentionTargetProfile(
        name=(contact_doc.get("name") or "").strip(),
        role=role,
        company=(contact_doc.get("company") or "").strip(),
        industry="",
        seniority=infer_seniority_from_role(role) or "",
        tone=tone,
        language_style=language_style,
        interests=interests,
        psych_traits=traits,
        recent_focus_summary=_compact_summary(summary_source, 150),
    )


def _extract_sender_profile(sender_doc: Optional[Dict[str, Any]]) -> MentionSenderProfile:
    if not sender_doc:
        return MentionSenderProfile()

    bio = (sender_doc.get("bio") or "").strip()
    tone, _, _ = _infer_tone_language_traits(bio)

    credibility: List[str] = []
    role = (sender_doc.get("role") or "").strip()
    company = (sender_doc.get("company") or "").strip()
    website = (sender_doc.get("website") or "").strip()
    socials = sender_doc.get("socials") or {}

    if role and company:
        credibility.append(f"{role} at {company}")
    elif role:
        credibility.append(role)
    if website:
        credibility.append(f"Website: {website}")
    if socials.get("linkedin"):
        credibility.append("Active LinkedIn profile")
    if socials.get("github"):
        credibility.append("Technical GitHub presence")

    value_bits = []
    if role and company:
        value_bits.append(f"{role} driving outcomes at {company}")
    if bio:
        value_bits.append(bio)
    if not value_bits and sender_doc.get("name"):
        value_bits.append(f"{sender_doc.get('name')} is reaching out for a focused collaboration.")

    return MentionSenderProfile(
        name=(sender_doc.get("name") or "").strip(),
        role=role,
        company=company,
        credibility_points=_clip_list(credibility, 5),
        value_proposition=_compact_summary(" ".join(value_bits), 120),
        tone_preference=tone,
    )


def _extract_intent_type(clean_instruction: str) -> str:
    text = clean_instruction.lower()
    if "follow up" in text or "follow-up" in text:
        return "follow_up"
    if any(k in text for k in ["collab", "collaboration", "partner", "partnership"]):
        return "collaboration_outreach"
    if any(k in text for k in ["meeting", "schedule", "calendar", "call"]):
        return "meeting_request"
    if any(k in text for k in ["intro", "introduction", "connect"]):
        return "introduction_request"
    if any(k in text for k in ["email", "message", "dm", "whatsapp", "sms"]):
        return "draft_outreach_message"
    return "outreach"


def _extract_topic_lock(clean_instruction: str, topic_lock_hint: Optional[str]) -> str:
    if topic_lock_hint:
        return _compact_summary(topic_lock_hint, 24)

    text = clean_instruction.strip()
    if not text:
        return "outreach request"

    patterns = [
        r"(?:send|write|draft|compose|create)\s+(?:him|her|them|me)?\s*(?:an?|the)?\s*(.+)$",
        r"(?:about|regarding|on)\s+(.+)$",
    ]

    noise_terms = [
        "email", "message", "dm", "whatsapp", "sms", "linkedin", "linkedina",
        "linkdin", "instagram", "twitter", "thread", "post", "outreach",
        "watsapp", "whatappa", "whatapp", "whatsap",
        "send", "write", "draft", "compose", "create", "him", "her", "them", "me",
    ]
    noise_re = r"\b(" + "|".join(re.escape(t) for t in noise_terms) + r")\b"

    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            candidate = match.group(1).strip(" .,!?:;")
            candidate = re.sub(noise_re, "", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"\s+", " ", candidate).strip()
            candidate = re.sub(r"\bcollaboration\s+about\b", "collaboration", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"^(?:(?:and|for|to|about)\s+)+", "", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"\b(and|for|to)\b\s*$", "", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"\s+", " ", candidate).strip()
            if candidate:
                return _compact_summary(candidate, 24)
    fallback = re.sub(noise_re, "", text, flags=re.IGNORECASE)
    fallback = re.sub(r"\s+", " ", fallback).strip(" .,!?:;")
    return _compact_summary(fallback or text, 24)


async def _fetch_target(user_email: str, mention_tokens: List[str]) -> MentionTargetProfile:
    if not mention_tokens:
        return MentionTargetProfile()
    contact_doc = await asyncio.to_thread(_query_target_contact, user_email, mention_tokens)
    return _extract_target_profile(contact_doc, mention_tokens)


async def _fetch_sender(user_email: str) -> MentionSenderProfile:
    if not user_email:
        return MentionSenderProfile()
    sender_doc = await asyncio.to_thread(_sender_doc_for_email, user_email)
    return _extract_sender_profile(sender_doc)


async def _extract_task(clean_instruction: str, topic_lock_hint: Optional[str]) -> MentionTaskIntent:
    channels = infer_channels_from_instruction(clean_instruction or "")
    channel_hint = (channels[0] if channels else "email")
    return MentionTaskIntent(
        intent_type=_extract_intent_type(clean_instruction),
        topic_lock=_extract_topic_lock(clean_instruction, topic_lock_hint),
        channel_hint=channel_hint,
    )


def _build_compressed_memory(
    target: MentionTargetProfile,
    sender: MentionSenderProfile,
    task: MentionTaskIntent,
) -> str:
    lines = [
        "TARGET:",
        f"- Name: {target.name or 'Unknown'}",
        f"- Role: {target.role or 'Unknown'} at {target.company or 'Unknown'}",
        f"- Seniority: {target.seniority or 'unknown'} | Tone: {target.tone or 'professional'} | Style: {target.language_style or 'clear'}",
        f"- Interests: {', '.join(target.interests[:4]) or 'n/a'}",
        f"- Traits: {', '.join(target.psych_traits[:4]) or 'n/a'}",
        f"- Recent focus: {_truncate_words(target.recent_focus_summary, 60) or 'n/a'}",
        "SENDER:",
        f"- Name: {sender.name or 'Unknown'}",
        f"- Role: {sender.role or 'Unknown'} at {sender.company or 'Unknown'}",
        f"- Credibility: {', '.join(sender.credibility_points[:4]) or 'n/a'}",
        f"- Value proposition: {_truncate_words(sender.value_proposition, 55) or 'n/a'}",
        f"- Tone preference: {sender.tone_preference or 'professional'}",
        "TASK:",
        f"- Intent: {task.intent_type or 'outreach'}",
        f"- Topic lock: {task.topic_lock or 'outreach'}",
        f"- Channel hint: {task.channel_hint or 'email'}",
    ]
    return _truncate_words("\n".join(lines), MAX_INJECTION_TOKENS)


async def build_context_injection(
    user_instruction: str,
    user_email: Optional[str] = None,
    topic_lock_hint: Optional[str] = None,
) -> ContextInjection:
    cache_key = f"{(user_email or '').lower()}::{(topic_lock_hint or '').lower()}::{(user_instruction or '').strip().lower()}"
    now = time.time()
    cached = _context_cache.get(cache_key)
    if cached and now - cached[0] <= _CONTEXT_CACHE_TTL_SECONDS:
        return cached[1]

    start = time.perf_counter()
    mention_tokens = _extract_mentions(user_instruction or "")
    clean_instruction = re.sub(MENTION_RE, "", user_instruction or "").strip()
    clean_instruction = re.sub(r"\s+", " ", clean_instruction).strip()

    target_profile, sender_profile, task_intent = await asyncio.gather(
        _fetch_target(user_email or "", mention_tokens),
        _fetch_sender(user_email or ""),
        _extract_task(clean_instruction, topic_lock_hint),
    )

    context = ContextInjection(
        target_profile=target_profile,
        sender_profile=sender_profile,
        task_intent=task_intent,
        mention_tokens=mention_tokens,
    )
    context.compressed_memory = _build_compressed_memory(
        context.target_profile,
        context.sender_profile,
        context.task_intent,
    )
    context.extraction_ms = int((time.perf_counter() - start) * 1000)
    _context_cache[cache_key] = (now, context)
    return context


def context_to_prospect(context: Optional[ContextInjection]) -> Optional[ProspectProfile]:
    if not context:
        return None
    target = context.target_profile
    if not target or not target.name:
        return None
    has_substance = bool(
        (target.role and target.company)
        or target.interests
        or target.recent_focus_summary
    )
    if not has_substance:
        return None

    profile = ProspectProfile(
        name=target.name,
        role=target.role or "Professional",
        company=target.company or "Target Company",
        recent_activity=[target.recent_focus_summary] if target.recent_focus_summary else [],
        raw_bio=target.recent_focus_summary or "",
        industry=target.industry or None,
        seniority=target.seniority or infer_seniority_from_role(target.role),
        interests=target.interests or [],
        summary=target.recent_focus_summary or None,
        source_urls=[],
    )
    return profile


def _disc_from_target(target: MentionTargetProfile) -> str:
    trait_text = " ".join(target.psych_traits).lower()
    if any(k in trait_text for k in ["decisive", "leader"]):
        return "D"
    if any(k in trait_text for k in ["social", "influence"]):
        return "I"
    if any(k in trait_text for k in ["collaborative", "supportive"]):
        return "S"
    return "C"


def context_to_psych(context: Optional[ContextInjection]) -> Optional[PsychProfile]:
    if not context:
        return None
    target = context.target_profile
    if not target or not target.name:
        return None

    tone = target.tone or "professional"
    style_rules = []
    if target.language_style == "technical":
        style_rules.append("Use precise technical wording")
    if target.language_style == "concise":
        style_rules.append("Prefer short, direct sentences")
    if tone == "casual":
        style_rules.append("Keep the tone warm and conversational")
    if tone == "formal":
        style_rules.append("Use formal and executive language")
    for trait in target.psych_traits[:2]:
        style_rules.append(f"Mirror {trait.replace('_', ' ')} communication style")

    return PsychProfile(
        disc_type=_disc_from_target(target),
        communication_style=tone.title(),
        tone_instructions=[
            f"Match {tone} tone",
            "Stay on topic",
            "Avoid unsupported claims",
        ],
        style_rules=_clip_list(style_rules, 4),
    )
