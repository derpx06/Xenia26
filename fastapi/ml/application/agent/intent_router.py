"""
Intent Router — Pre-Supervisor gate for the Research Agent.

Classifies user input into one of four categories and extracts a
topic-lock + search keywords BEFORE any tool / LLM pipeline runs.
"""

import re
from typing import Optional, List

from loguru import logger
from pydantic import BaseModel, Field

from .config import LOGIC_MODEL, COMMON_TOPICS
from .helpers import init_llm_clients, cached_llm_call
from .schemas import AgentState


# ── Structured output models ──────────────────────────────────────────

class IntentResult(BaseModel):
    """LLM-returned intent classification."""
    category: str = Field(
        description=(
            "One of: small_talk, system_question, outreach_task, "
            "research_outreach_task"
        )
    )
    confidence: float = Field(description="0.0 – 1.0")
    direct_response: Optional[str] = Field(
        default=None,
        description="If small_talk or system_question, the response to send back.",
    )


class TopicLock(BaseModel):
    """Extracted topic constraints for downstream nodes."""
    primary_topic: str = Field(description="One-sentence description of the core topic.")
    domain_keywords: List[str] = Field(
        description="2-5 domain-only keywords suitable as search queries."
    )
    tone: str = Field(
        default="professional",
        description="Detected tone: formal, casual, friendly, urgent, etc.",
    )


# ── Core functions ────────────────────────────────────────────────────

def classify_intent(user_instruction: str) -> IntentResult:
    """
    Always uses LLM for intent classification and response generation.
    Only truly empty/blank inputs are caught before hitting the LLM.
    """
    stripped = user_instruction.strip()

    # Guard: empty input
    if not stripped:
        return IntentResult(
            category="small_talk",
            confidence=1.0,
            direct_response="Hey! What can I help you with?",
        )

    try:
        client, _, _ = init_llm_clients()
        result = cached_llm_call(
            client,
            model=LOGIC_MODEL,
            response_model=IntentResult,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are the intent router for an AI cold-outreach assistant.\n\n"
                        "Classify the user's message into one of these categories:\n"
                        "- small_talk: greetings, casual chat, thanks, goodbye, off-topic banter.\n"
                        "- system_question: questions about what you can do, how you work, who you are.\n"
                        "- outreach_task: request to draft outreach (email/linkedin/whatsapp/sms/etc.) "
                        "where the topic is common knowledge (no web research needed).\n"
                        "- research_outreach_task: outreach request that requires web research "
                        "(mentions a specific person/company URL, very niche topic, or explicitly asks to research someone).\n\n"
                        "RULES:\n"
                        "- If small_talk or system_question, generate a short, natural direct_response. "
                        "Be friendly and conversational. Always nudge the user toward giving you an outreach task.\n"
                        "- For outreach_task / research_outreach_task, set direct_response to null.\n"
                        "- Set confidence between 0.0 and 1.0."
                    ),
                },
                {"role": "user", "content": user_instruction},
            ],
            max_retries=1,
            use_cache=True,
        )
        logger.info(
            f"🎯 INTENT ROUTER: LLM classified → {result.category} "
            f"(conf={result.confidence:.2f})"
        )
        return result
    except Exception as e:
        logger.warning(f"🎯 INTENT ROUTER: LLM classification failed ({e}), defaulting to outreach_task")
        return IntentResult(category="outreach_task", confidence=0.5, direct_response=None)


def extract_topic(user_instruction: str) -> TopicLock:
    """
    Extract the primary topic, domain keywords, and tone from the user
    instruction.  Uses LLM with structured output.
    """
    try:
        client, _, _ = init_llm_clients()
        result = cached_llm_call(
            client,
            model=LOGIC_MODEL,
            response_model=TopicLock,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract the PRIMARY TOPIC from the user's outreach request.\n\n"
                        "Rules:\n"
                        "1. primary_topic: one sentence describing the CORE subject.\n"
                        "2. domain_keywords: 2-5 keywords for web search. "
                        "ONLY domain/technical terms. "
                        "REMOVE all instruction text like 'generate', 'write', '≤55 words', "
                        "'cold email', formatting constraints.\n"
                        "3. tone: the detected communication tone.\n\n"
                        "Example:\n"
                        "Input: 'Generate a cold email (≤55 words) to a mid-level FinTech "
                        "data scientist discussing model drift in fraud detection'\n"
                        "Output:\n"
                        "  primary_topic: 'Model drift in fraud detection systems'\n"
                        "  domain_keywords: ['model drift', 'fraud detection', 'fintech', 'data science']\n"
                        "  tone: 'professional'"
                    ),
                },
                {"role": "user", "content": user_instruction},
            ],
            max_retries=1,
            use_cache=True,
        )
        logger.info(f"🔒 TOPIC LOCK: '{result.primary_topic}' | keywords={result.domain_keywords}")
        return result
    except Exception as e:
        logger.warning(f"🔒 TOPIC LOCK: Extraction failed ({e}), using raw instruction")
        # Fallback: use raw instruction minus common meta words
        cleaned = re.sub(
            r"\b(generate|write|draft|create|compose|cold email|linkedin|whatsapp|sms)\b",
            "",
            user_instruction,
            flags=re.IGNORECASE,
        ).strip()
        words = [w for w in cleaned.split() if len(w) > 3][:5]
        return TopicLock(
            primary_topic=user_instruction[:120],
            domain_keywords=words or ["outreach"],
            tone="professional",
        )


def assess_knowledge_confidence(topic: str, keywords: List[str]) -> bool:
    """
    Return True if the topic is common enough that web search can be skipped.
    Uses a curated keyword list + simple heuristic.
    """
    combined = (topic + " " + " ".join(keywords)).lower()

    # Check against known common topics
    matches = sum(1 for t in COMMON_TOPICS if t in combined)
    if matches >= 2:
        logger.info(f"🧠 KNOWLEDGE CHECK: High confidence ({matches} common terms matched) → skip search")
        return True

    # If a URL is in the topic, we definitely need research
    if re.search(r"https?://", combined):
        logger.info("🧠 KNOWLEDGE CHECK: URL detected → needs search")
        return False

    # Single common term match with short topic → still confident
    if matches >= 1 and len(keywords) <= 3:
        logger.info(f"🧠 KNOWLEDGE CHECK: Moderate confidence ({matches} match) → skip search")
        return True

    logger.info("🧠 KNOWLEDGE CHECK: Low confidence → needs search")
    return False


# ── Graph node wrapper ────────────────────────────────────────────────

def intent_router_node(state: AgentState) -> dict:
    """
    LangGraph node.  Runs intent classification + topic extraction.
    Returns partial state update.
    """
    instruction = getattr(state, 'user_instruction', '') or ''
    logs = list(getattr(state, 'logs', []) or [])
    logger.info(f"🎯 INTENT ROUTER NODE: Processing '{instruction[:80]}...'")

    # Step 1: Classify intent
    intent = classify_intent(instruction)

    # If small talk or system question → bypass the entire pipeline
    if intent.category in ("small_talk", "system_question"):
        return {
            "intent_category": intent.category,
            "direct_response": intent.direct_response,
            "topic_lock": None,
            "search_keywords": [],
            "needs_search": False,
            "logs": logs + [
                f"[INTENT] {intent.category} detected → direct response"
            ],
        }

    # Step 2: Extract topic (only for real tasks)
    topic = extract_topic(instruction)

    # Step 3: Assess whether search is needed
    needs_search = not assess_knowledge_confidence(
        topic.primary_topic, topic.domain_keywords
    )

    # For research_outreach_task, always search
    if intent.category == "research_outreach_task":
        needs_search = True

    return {
        "intent_category": intent.category,
        "direct_response": None,
        "topic_lock": topic.primary_topic,
        "search_keywords": topic.domain_keywords,
        "needs_search": needs_search,
        "logs": logs + [
            f"[INTENT] {intent.category} (conf={intent.confidence:.2f})",
            f"[TOPIC LOCK] {topic.primary_topic}",
            f"[SEARCH] {'needed' if needs_search else 'skipped (high confidence)'}",
        ],
    }
