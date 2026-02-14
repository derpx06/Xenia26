import asyncio
import json
import re
import threading
import time
from typing import Any, Dict, List
from urllib.parse import urlparse

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama

try:
    from ddgs import DDGS
except Exception:  # pragma: no cover - optional at runtime
    try:
        from duckduckgo_search import DDGS  # type: ignore
    except Exception:  # pragma: no cover - optional at runtime
        DDGS = None

try:
    from tavily import TavilyClient
except Exception:  # pragma: no cover - optional at runtime
    TavilyClient = None

try:
    import wikipedia
except Exception:  # pragma: no cover - optional at runtime
    wikipedia = None

from .configuration import Configuration
from .prompts import EDITOR_PROMPT, HUMANIZE_PROMPT, ORCHESTRATOR_PROMPT, PLANNER_PROMPT, WRITER_PROMPT
from .state import AgentState, WorkerState

_SEARCH_CACHE_LOCK = threading.Lock()
_SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}


def _cache_key(namespace: str, query: str, **kwargs: Any) -> str:
    payload = {"q": query, **kwargs}
    encoded = json.dumps(payload, ensure_ascii=True, sort_keys=True)
    return f"{namespace}:{encoded}"


def _cache_get(conf: Configuration, key: str) -> Any | None:
    if not conf.enable_search_cache:
        return None
    now = time.time()
    ttl = max(30, int(conf.search_cache_ttl_seconds))
    with _SEARCH_CACHE_LOCK:
        row = _SEARCH_CACHE.get(key)
        if not row:
            return None
        if (now - float(row.get("ts", 0.0))) > ttl:
            _SEARCH_CACHE.pop(key, None)
            return None
        return row.get("value")


def _cache_set(conf: Configuration, key: str, value: Any) -> None:
    if not conf.enable_search_cache:
        return
    with _SEARCH_CACHE_LOCK:
        _SEARCH_CACHE[key] = {"ts": time.time(), "value": value}


def strip_thinking_tokens(text: str) -> str:
    while "<think>" in text and "</think>" in text:
        start = text.find("<think>")
        end = text.find("</think>") + len("</think>")
        text = text[:start] + text[end:]
    return text


def _truncate(text: str, max_chars: int) -> str:
    value = (text or "").strip()
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3].rstrip() + "..."


def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host.replace("www.", "")
    except Exception:
        return "source"


def _sanitize_writer_output(text: str) -> str:
    if not text:
        return ""
    banned_prefixes = (
        "Section title:",
        "Guidelines:",
        "Previous section",
        "Previous Section",
        "Research Bible:",
        "Target words:",
        "Topic:",
        "Writing brief:",
        "Image candidates:",
        "Evidence anchors:",
        "Cite concrete findings",
        "Use verifiable claims",
        "[PHASE]",
        "[SYSTEM]",
        "[WORKER]",
        "[ORCHESTRATOR]",
        "[SYNTHESIZER]",
        "[PLANNER]",
        "[WRITER]",
        "[EDITOR]",
        "[HUMANIZE]",
    )
    clean_lines: List[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if any(stripped.startswith(prefix) for prefix in banned_prefixes):
            continue
        if re.match(r"^Section\s+\d+\s*:", stripped):
            continue
        clean_lines.append(line)
    cleaned = "\n".join(clean_lines).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned


def _canonical_topic_from_text(text: str) -> str:
    lowered = (text or "").lower()
    if "attention is all you need" in lowered:
        return "Attention Is All You Need"
    return ""


def _looks_robotic(text: str) -> bool:
    plain = _markdown_to_text(text)
    if not plain:
        return True

    robotic_markers = (
        "in conclusion",
        "moreover",
        "furthermore",
        "this section focuses on",
        "it is important to note",
    )
    marker_hits = sum(1 for marker in robotic_markers if marker in plain.lower())
    if marker_hits >= 2:
        return True

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", plain) if s.strip()]
    if len(sentences) < 3:
        return False

    # Repetitive sentence openings can make prose sound synthetic.
    starters: List[str] = []
    for s in sentences:
        parts = s.lower().split()
        starters.append(" ".join(parts[:3]))
    duplicate_ratio = 1.0 - (len(set(starters)) / max(1, len(starters)))

    return duplicate_ratio > 0.4


def _safe_json_loads(text: str, default: Dict[str, Any]) -> Dict[str, Any]:
    content = strip_thinking_tokens((text or "").strip())
    content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"^```\s*|\s*```$", "", content, flags=re.MULTILINE)
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
        return default
    except Exception:
        return default


def _extract_request_constraints(topic_text: str) -> Dict[str, Any]:
    text = str(topic_text or "")
    target_words = 900
    target_match = re.search(
        r"(?:target\s*(?:length|words?)|word\s*count|length)\s*[:\-]?\s*(\d{3,4})",
        text,
        flags=re.IGNORECASE,
    )
    if target_match:
        try:
            target_words = int(target_match.group(1))
        except Exception:
            target_words = 900
    target_words = max(450, min(2200, target_words))

    def _extract(label: str, default: str) -> str:
        match = re.search(rf"{label}\s*:\s*([^\n]+)", text, flags=re.IGNORECASE)
        if not match:
            return default
        return str(match.group(1)).strip()

    return {
        "target_words": target_words,
        "format": _extract("format", "Thought Leadership"),
        "tone": _extract("tone", "Insightful"),
        "audience": _extract("audience", "technical readers"),
        "keyword": _extract("keyword", ""),
    }


def _extract_topic_focus(topic_text: str) -> str:
    text = str(topic_text or "").strip()
    if not text:
        return ""

    canonical = _canonical_topic_from_text(text)
    if canonical:
        return canonical

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return text

    quoted_match = re.search(r"['\"]([^'\"]{6,140})['\"]", text)
    if quoted_match:
        candidate = quoted_match.group(1).strip()
        if len(candidate.split()) >= 2:
            canonical = _canonical_topic_from_text(candidate)
            return canonical or candidate

    for idx, line in enumerate(lines):
        if line.lower() == "task":
            for candidate in lines[idx + 1:]:
                lowered = candidate.lower()
                if lowered.startswith(("article brief", "output rules", "format:", "tone:", "audience:", "keyword:", "target")):
                    break
                if candidate:
                    canonical = _canonical_topic_from_text(candidate)
                    return canonical or candidate

    for line in lines:
        lowered = line.lower()
        if lowered in {"task", "article brief", "output rules"}:
            continue
        if lowered.startswith(("-", "*")):
            continue
        if lowered.startswith(("you are ", "article brief", "output rules", "format:", "tone:", "audience:", "keyword:", "target length:", "target words:", "title hint:", "primary keyword:")):
            continue
        canonical = _canonical_topic_from_text(line)
        return canonical or line

    canonical = _canonical_topic_from_text(lines[0])
    return canonical or lines[0]


def _coerce_sub_topics(topic: str, payload: Dict[str, Any]) -> List[str]:
    topic_focus = _extract_topic_focus(topic) or topic
    raw = payload.get("sub_topics", [])
    topics = [str(x).strip() for x in raw if str(x).strip()]
    topics = list(dict.fromkeys(topics))

    lowered_focus = topic_focus.lower()
    is_attention_paper = "attention is all you need" in lowered_focus or "transformer" in lowered_focus

    if is_attention_paper:
        smart_defaults = [
            "What problem the 2017 paper solved and why RNN/CNN seq2seq models struggled",
            "Self-attention in simple language with the Q/K/V idea and scaled dot-product",
            "Transformer architecture: encoder, decoder, multi-head attention, residuals, layer norm",
            "Positional encoding, parallel training speed, and why Transformers scaled better",
            "Limitations of the original paper and how modern LLMs evolved from it",
        ]
    else:
        smart_defaults = [
            f"Core concepts and first-principles explanation of {topic_focus}",
            f"How {topic_focus} works in real systems (architecture and data flow)",
            f"Practical implementation choices, trade-offs, and common failure modes for {topic_focus}",
            f"Evaluation metrics, benchmarks, and measurable outcomes for {topic_focus}",
            f"Contrarian mistakes teams make when deploying {topic_focus}",
        ]

    topic_terms = _topic_terms(topic_focus)

    def _is_relevant_subtopic(candidate: str) -> bool:
        lowered = candidate.lower()
        if not lowered:
            return False
        if any(
            marker in lowered
            for marker in (
                "cold outreach",
                "email sequence",
                "writer struggle",
                "content calendar",
                "social media post",
            )
        ):
            return False
        if not topic_terms:
            return True
        hits = sum(1 for term in topic_terms if re.search(rf"\b{re.escape(term)}\b", lowered))
        # Keep the filter permissive but still reject clearly unrelated plans.
        return hits >= 1

    relevant_topics = [topic for topic in topics if _is_relevant_subtopic(topic)]
    merged = list(dict.fromkeys(smart_defaults + relevant_topics))
    return merged[:5]


def _target_subtopic_count(target_words: int, conf: Configuration) -> int:
    if target_words <= 700:
        preferred = 3
    elif target_words <= 1200:
        preferred = 4
    else:
        preferred = 5
    return max(2, min(int(conf.max_parallel_subtopics), preferred))


def _normalize_outline(
    outline: List[Dict[str, Any]],
    fallback_topics: List[str],
    *,
    desired_total_words: int = 900,
    article_topic: str = "",
) -> List[Dict[str, Any]]:
    desired_total_words = max(450, min(2200, int(desired_total_words or 900)))
    target_sections = 5 if desired_total_words >= 900 else (4 if desired_total_words >= 700 else 3)
    max_sections = 6

    clean: List[Dict[str, Any]] = []
    seen_titles = set()
    for idx, section in enumerate(outline or []):
        title = str(section.get("title", "")).strip()
        if not title or title.lower() in seen_titles:
            title = f"Section {idx + 1}"
        seen_titles.add(title.lower())
        guidelines = str(section.get("guidelines", "")).strip() or "Explain mechanisms, trade-offs, and execution details."
        evidence_hint = str(section.get("evidence_hint", "")).strip() or "Use concrete findings from the research bible."
        try:
            word_count = int(section.get("word_count", 0))
        except Exception:
            word_count = 0
        clean.append(
            {
                "title": title,
                "guidelines": guidelines,
                "evidence_hint": evidence_hint,
                "word_count": word_count,
            }
        )

    for topic in fallback_topics:
        if len(clean) >= target_sections:
            break
        title = str(topic or "").strip()
        if not title:
            continue
        if title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())
        clean.append(
            {
                "title": title,
                "guidelines": "Explain this concept in simple language, then connect it to practical decisions.",
                "evidence_hint": "Cite concrete findings from research sources and benchmark context.",
                "word_count": 0,
            }
        )

    if len(clean) < target_sections:
        topic_focus = _extract_topic_focus(article_topic) or "the topic"
        auto_titles = [
            f"What problem {topic_focus} solves",
            f"How {topic_focus} works step by step",
            f"Why this approach outperforms older methods",
            f"Implementation lessons and common mistakes",
            f"Limitations and where the field is heading next",
        ]
        for title in auto_titles:
            if len(clean) >= target_sections:
                break
            if title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())
            clean.append(
                {
                    "title": title,
                    "guidelines": "Keep this section concrete, simple to follow, and connected to the user topic.",
                    "evidence_hint": "Use verifiable claims from the research bible and external references.",
                    "word_count": 0,
                }
            )

    if not clean:
        topic_focus = _extract_topic_focus(article_topic) or "the topic"
        clean = [
            {
                "title": f"Why {topic_focus} matters right now",
                "guidelines": "Open with a sharp hook, define the problem, and set reader expectations.",
                "evidence_hint": "Use one concrete stat or historical reference from the research bible.",
                "word_count": 0,
            },
            {
                "title": f"How {topic_focus} works under the hood",
                "guidelines": "Explain the mechanism step by step using plain-language analogies.",
                "evidence_hint": "Use source-backed technical evidence.",
                "word_count": 0,
            },
            {
                "title": f"What teams get right and wrong with {topic_focus}",
                "guidelines": "Show practical trade-offs, pitfalls, and implementation advice.",
                "evidence_hint": "Anchor claims in observed outcomes and references.",
                "word_count": 0,
            },
        ]

    clean = clean[:max_sections]
    per_section = max(150, min(300, round(desired_total_words / max(1, len(clean)))))
    for idx, section in enumerate(clean):
        raw_wc = int(section.get("word_count", 0) or 0)
        if raw_wc <= 0:
            raw_wc = per_section
        section["word_count"] = max(140, min(320, raw_wc))
        if not section["title"].strip():
            section["title"] = f"Section {idx + 1}"

    return clean


def _tail_sentences(text: str, max_sentences: int = 3, max_chars: int = 500) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    tail = " ".join(sentences[-max_sentences:]).strip()
    if len(tail) > max_chars:
        tail = tail[-max_chars:]
    return tail


def _sorted_section_items(draft_sections: Dict[int, str]) -> List[str]:
    if not isinstance(draft_sections, dict):
        return []

    def _to_int(value: Any) -> int:
        try:
            return int(value)
        except Exception:
            return 10**9

    ordered = []
    for key in sorted(draft_sections.keys(), key=_to_int):
        text = str(draft_sections.get(key, "")).strip()
        if text:
            ordered.append(text)
    return ordered


def _count_markdown_images(text: str) -> int:
    return len(re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text or ""))


def _image_looks_relevant(image_url: str, topic_focus: str, section_title: str, keyword: str = "") -> bool:
    if not image_url:
        return False
    haystack = f"{image_url} {topic_focus} {section_title} {keyword}".lower()
    # Common noisy image sources that frequently return generic stock art.
    if any(
        host in haystack
        for host in ("unsplash.com", "pexels.com", "shutterstock.com", "istockphoto.com")
    ):
        return False
    terms = _topic_terms(topic_focus, keyword) + _tokenize_keywords(section_title, limit=6)
    if not terms:
        return True
    return any(term in haystack for term in terms[:6])


def _inject_markdown_image(section_body: str, section_title: str, image_url: str) -> str:
    if not image_url or "![" in (section_body or ""):
        return section_body
    lines = (section_body or "").splitlines()
    if not lines:
        return section_body
    image_line = f"![{_truncate(section_title, 70)} visual]({image_url})"
    if lines[0].startswith("## "):
        return "\n".join([lines[0], "", image_line, ""] + lines[1:]).strip()
    return f"{image_line}\n\n{section_body}".strip()


def _format_web_results(results: Dict[str, Any], max_items: int = 4) -> List[str]:
    rows = results.get("results", []) if isinstance(results, dict) else []
    out: List[str] = []
    seen_urls = set()
    for item in rows:
        url = str(item.get("url", "")).strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        title = _truncate(str(item.get("title", "Untitled")).strip(), 120)
        content = _truncate(str(item.get("content", "")).replace("\n", " ").strip(), 260)
        out.append(f"[{_domain(url)}] {title} | {content} | {url}")
        if len(out) >= max_items:
            break
    return out


def _filter_search_results_by_topic(results: Dict[str, Any], topic_text: str, max_items: int) -> Dict[str, Any]:
    if not isinstance(results, dict):
        return {"results": []}

    rows = results.get("results", [])
    if not isinstance(rows, list) or not rows:
        return {"results": []}

    terms = _topic_terms(topic_text)
    if not terms:
        return {"results": rows[:max_items]}

    scored: List[tuple[int, Dict[str, Any]]] = []
    for row in rows:
        title = str(row.get("title", "")).lower()
        content = str(row.get("content", "")).lower()
        url = str(row.get("url", "")).lower()
        haystack = f"{title} {content} {url}"
        score = sum(1 for term in terms if re.search(rf"\b{re.escape(term)}\b", haystack))
        scored.append((score, row))

    filtered = [row for score, row in sorted(scored, key=lambda item: item[0], reverse=True) if score > 0]
    if not filtered:
        filtered = [row for _, row in sorted(scored, key=lambda item: item[0], reverse=True)]
    return {"results": filtered[:max_items]}


def _merge_search_rows(primary: Dict[str, Any], secondary: Dict[str, Any], max_items: int) -> Dict[str, Any]:
    out: List[Dict[str, Any]] = []
    seen_urls = set()
    for source in (primary, secondary):
        for item in source.get("results", []) if isinstance(source, dict) else []:
            url = str(item.get("url", "")).strip()
            title = str(item.get("title", "")).strip()
            if not url or not title or url in seen_urls:
                continue
            seen_urls.add(url)
            out.append(
                {
                    "title": title,
                    "url": url,
                    "content": str(item.get("content", "")).strip(),
                }
            )
            if len(out) >= max_items:
                return {"results": out}
    return {"results": out}


def _format_wikipedia_results(rows: List[Dict[str, str]], max_items: int = 3) -> List[str]:
    out: List[str] = []
    for item in rows[:max_items]:
        title = _truncate(item.get("title", "Wikipedia"), 100)
        summary = _truncate(item.get("summary", ""), 260)
        url = item.get("url", "")
        if not title or not summary:
            continue
        out.append(f"[wikipedia] {title} | {summary} | {url}")
    return out


def _extract_images_from_tavily(payload: Dict[str, Any], max_items: int = 4) -> List[str]:
    images: List[str] = []
    if not isinstance(payload, dict):
        return images

    raw_images = payload.get("images", [])
    for entry in raw_images if isinstance(raw_images, list) else []:
        if isinstance(entry, str):
            images.append(entry.strip())
        elif isinstance(entry, dict):
            url = str(entry.get("url") or entry.get("image_url") or "").strip()
            if url:
                images.append(url)

    for row in payload.get("results", []) if isinstance(payload.get("results", []), list) else []:
        for key in ("image", "image_url", "thumbnail"):
            url = str(row.get(key, "")).strip()
            if url:
                images.append(url)

    deduped: List[str] = []
    seen = set()
    for url in images:
        if url and url not in seen:
            seen.add(url)
            deduped.append(url)
        if len(deduped) >= max_items:
            break
    return deduped


def _compress_research_note(note: str, max_bullets: int = 10, max_chars: int = 1800) -> str:
    lines = [line.rstrip() for line in (note or "").splitlines() if line.strip()]
    if not lines:
        return ""
    heading = next((line for line in lines if line.startswith("### ")), "### Research Slice")
    bullets = [line for line in lines if line.lstrip().startswith("-")]
    compact = [heading] + bullets[:max_bullets]
    text = "\n".join(compact).strip()
    return _truncate(text, max_chars)


def _slice_research_bible(text: str, max_chars: int) -> str:
    value = (text or "").strip()
    if len(value) <= max_chars:
        return value
    return value[:max_chars].rsplit("\n", 1)[0].strip()


def _tokenize_keywords(text: str, limit: int = 16) -> List[str]:
    stop = {
        "with", "from", "that", "this", "about", "their", "there", "which", "into",
        "while", "where", "when", "under", "over", "only", "also", "using", "build",
        "article", "section", "write", "guidelines", "evidence", "topic",
    }
    words = re.findall(r"[a-zA-Z]{4,}", (text or "").lower())
    uniq: List[str] = []
    seen = set()
    for word in words:
        if word in stop or word in seen:
            continue
        seen.add(word)
        uniq.append(word)
        if len(uniq) >= limit:
            break
    return uniq


def _compact_search_query(text: str, max_terms: int = 10) -> str:
    keywords = _tokenize_keywords(text, limit=max_terms)
    if not keywords:
        return _truncate(text, 120)
    return " ".join(keywords[:max_terms])


def _markdown_to_text(markdown_text: str) -> str:
    text = str(markdown_text or "")
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", " ", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _topic_terms(topic_focus: str, keyword: str = "") -> List[str]:
    terms = _tokenize_keywords(f"{topic_focus} {keyword}", limit=12)
    if not terms:
        return []
    # Prefer more specific terms first.
    terms = sorted(set(terms), key=lambda item: (-len(item), item))
    return terms[:8]


def _text_mentions_topic(text: str, topic_focus: str, keyword: str = "") -> bool:
    plain = _markdown_to_text(text).lower()
    if not plain:
        return False
    terms = _topic_terms(topic_focus, keyword)
    if not terms:
        return True
    hits = 0
    for term in terms:
        if re.search(rf"\b{re.escape(term)}\b", plain):
            hits += 1
    return hits >= 1


def _has_off_topic_markers(text: str) -> bool:
    lowered = _markdown_to_text(text).lower()
    off_topic_markers = (
        "cold email",
        "linkedin dm",
        "whatsapp outreach",
        "sales pipeline",
        "crm sequence",
        "prospect follow-up",
        "compliance risk banned accounts",
    )
    return any(marker in lowered for marker in off_topic_markers)


def _is_generic_or_drifting(text: str, topic_focus: str, keyword: str = "") -> bool:
    plain = _markdown_to_text(text)
    lowered = plain.lower()
    if len(plain.split()) < 35:
        return True
    generic_phrases = (
        "most teams underinvest in execution details",
        "this section focuses on practical execution and measurable outcomes",
        "translate research into clear, high-leverage actions",
        "open with a counterintuitive claim and explain why it matters now",
        "evidence anchors:",
        "cite concrete findings from research sources",
    )
    if any(phrase in lowered for phrase in generic_phrases):
        return True

    # Keep the guard loose: only flag for topic drift when there is no topic anchor
    # and explicit signs of unrelated domain content.
    if not _text_mentions_topic(plain, topic_focus, keyword) and _has_off_topic_markers(plain):
        return True
    return False


def _clip_to_word_count(markdown_text: str, target_words: int, max_ratio: float = 1.45) -> str:
    if not markdown_text.strip() or target_words <= 0:
        return markdown_text
    limit = int(target_words * max_ratio)
    words = markdown_text.split()
    if len(words) <= limit:
        return markdown_text
    clipped = " ".join(words[:limit]).strip()
    last_break = max(clipped.rfind("."), clipped.rfind("!"), clipped.rfind("?"))
    if last_break > int(len(clipped) * 0.7):
        return clipped[: last_break + 1].strip()
    return clipped + "..."


def _extract_evidence_points(research_slice: str, max_points: int = 4) -> List[Dict[str, str]]:
    points: List[Dict[str, str]] = []
    for raw_line in (research_slice or "").splitlines():
        line = raw_line.strip()
        if "|" not in line:
            continue
        line = re.sub(r"^[-*]\s*", "", line)
        match = re.match(r"^\[([^\]]+)\]\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(https?://\S+)$", line)
        if not match:
            continue
        domain = _truncate(match.group(1).strip(), 40)
        title = _truncate(match.group(2).strip(), 110)
        summary = _truncate(match.group(3).strip(), 180)
        url = match.group(4).strip()
        points.append(
            {
                "domain": domain,
                "title": title,
                "summary": summary,
                "url": url,
            }
        )
        if len(points) >= max_points:
            break
    return points


def _topic_simple_alias(topic: str) -> str:
    lowered = (topic or "").lower()
    if "attention is all you need" in lowered:
        return "the Attention Is All You Need paper"
    return _extract_topic_focus(topic) or "this topic"


def _fallback_section_text(
    topic: str,
    audience: str,
    tone: str,
    section_title: str,
    guidelines: str,
    evidence_hint: str,
    research_slice: str,
    target_words: int,
) -> str:
    topic_alias = _topic_simple_alias(topic)
    reader = _truncate((audience or "technical readers"), 80)
    writing_tone = (tone or "insightful").strip().lower()
    paper_mode = "attention is all you need" in (topic or "").lower() or "attention is all you need" in section_title.lower()
    usable_research = _slice_research_bible(research_slice, 1200)

    title_l = section_title.lower()
    if paper_mode and any(k in title_l for k in ("outperform", "benchmark", "result", "speed", "impact", "why")):
        middle = (
            "The breakthrough was both quality and efficiency. "
            "Attention-based computation parallelizes well on modern hardware, reducing training bottlenecks compared with recurrent models. "
            "That scaling advantage is one reason Transformer variants became the base of modern LLM systems."
        )
    elif paper_mode and any(k in title_l for k in ("problem", "motivation")):
        middle = (
            "Before Transformers, sequence models like RNNs and LSTMs processed tokens one step at a time. "
            "That made long-range dependencies hard to learn and limited parallel training speed. "
            "The paper reframed the problem: model token relationships directly with attention, without recurrence."
        )
    elif paper_mode and any(k in title_l for k in ("mechanism", "attention", "self-attention", "q/k/v")):
        middle = (
            "Self-attention can be read as a relevance lookup. "
            "Each token creates a Query, Key, and Value vector. "
            "Similarity between Query and Keys gives attention weights, and those weights mix the Values into context-aware token representations."
        )
    elif paper_mode and any(k in title_l for k in ("architecture", "encoder", "decoder", "multi-head", "positional")):
        middle = (
            "The architecture stacks encoder and decoder blocks, each with multi-head attention and feed-forward layers. "
            "Multi-head attention lets the model track different relationship types in parallel, while positional encodings preserve word-order signals."
        )
    elif paper_mode and any(k in title_l for k in ("limit", "trade-off", "future")):
        middle = (
            "The original design has a known cost: full self-attention grows quadratically with sequence length. "
            "That trade-off inspired later work on sparse, linear, and memory-efficient attention variants."
        )
    else:
        middle = (
            f"{guidelines} Translate the concept into plain language first, then connect it to a practical decision the reader can make."
        )

    opener = (
        f"## {section_title}\n\n"
        f"Let us make {topic_alias} understandable for {reader}. "
        f"This section keeps the tone {writing_tone} and focuses on what actually matters in practice."
    )
    evidence_block = ""
    if usable_research:
        evidence_block = (
            "Use this supporting context as factual guardrails while keeping the prose clean and readable:\n\n"
            f"> {_truncate(_markdown_to_text(usable_research), 420)}"
        )

    close = "The key takeaway: if you can explain this mechanism clearly, you can evaluate tools and claims with far more confidence."
    practical = (
        f"In practice, when you implement {topic_alias}, focus on one component at a time and validate it with a tiny reproducible experiment "
        "before scaling to larger datasets or production-like traffic."
    )
    recap = "Keep one principle in mind: simple explanations are not shallow when they preserve the core mechanism."

    body_parts = [opener, middle, practical, close, recap]
    if evidence_block:
        body_parts.insert(2, evidence_block)
    body = "\n\n".join(body_parts)
    return _clip_to_word_count(body, target_words=target_words, max_ratio=1.3)


def _dedupe_repeated_headings(markdown_text: str) -> str:
    if not markdown_text:
        return ""
    lines = markdown_text.splitlines()
    seen_sections = set()
    cleaned_lines: List[str] = []
    skip = False
    for line in lines:
        heading_match = re.match(r"^\s*##\s+(.+?)\s*$", line)
        if heading_match:
            section_name = heading_match.group(1).strip().lower()
            if section_name in seen_sections:
                skip = True
                continue
            seen_sections.add(section_name)
            skip = False
            cleaned_lines.append(line)
            continue
        if skip:
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def _sanitize_final_article(text: str, topic_focus: str, keyword: str = "", ensure_h1: bool = True) -> str:
    if not text:
        return ""

    cleaned = _sanitize_writer_output(strip_thinking_tokens(text))
    # Remove leaked process logs and prompt debris.
    cleaned = re.sub(r"(?im)^\s*\[(?:PHASE|SYSTEM|ORCHESTRATOR|WORKER|SYNTHESIZER|PLANNER|WRITER|EDITOR|HUMANIZE)\].*$", "", cleaned)
    cleaned = re.sub(r"(?im)^.*(?:Evidence anchors:|Cite concrete findings|Use verifiable claims).*$", "", cleaned)
    cleaned = re.sub(r"(?im)^.*(?:Section title:|Guidelines:|Target words:|Writing brief:).*$", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    cleaned = _dedupe_repeated_headings(cleaned)

    # Remove exact duplicate paragraphs while preserving order.
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    seen = set()
    deduped_paragraphs: List[str] = []
    for para in paragraphs:
        key = _markdown_to_text(para).lower()
        if key in seen:
            continue
        seen.add(key)
        deduped_paragraphs.append(para)
    cleaned = "\n\n".join(deduped_paragraphs).strip()

    # Ensure top-level heading exists exactly once.
    h1_matches = list(re.finditer(r"(?im)^#\s+.+$", cleaned))
    if ensure_h1 and len(h1_matches) > 1:
        # Keep first H1 and demote the rest.
        first_idx = h1_matches[0].start()
        keep = cleaned[:first_idx] + cleaned[first_idx:]
        lines = keep.splitlines()
        h1_seen = False
        normalized: List[str] = []
        for line in lines:
            if re.match(r"^#\s+.+$", line.strip()):
                if h1_seen:
                    normalized.append(re.sub(r"^#\s+", "## ", line))
                else:
                    h1_seen = True
                    normalized.append(line)
            else:
                normalized.append(line)
        cleaned = "\n".join(normalized).strip()
    elif ensure_h1 and len(h1_matches) == 0:
        title = _topic_simple_alias(topic_focus or keyword or "Article")
        cleaned = f"# {title}\n\n{cleaned}".strip()

    return cleaned


def _extract_relevant_research_slice(
    research_bible: str,
    section_title: str,
    evidence_hint: str,
    max_chars: int = 3600,
) -> str:
    text = (research_bible or "").strip()
    if not text:
        return ""
    if len(text) <= max_chars:
        return text

    keywords = _tokenize_keywords(f"{section_title} {evidence_hint}", limit=18)
    parts = text.split("\n### ")
    prefix = parts[0].strip()
    blocks = [f"### {chunk}".strip() for chunk in parts[1:]]

    scored: List[tuple[int, str]] = []
    for block in blocks:
        lowered = block.lower()
        score = sum(1 for kw in keywords if kw in lowered)
        scored.append((score, block))
    scored.sort(key=lambda item: item[0], reverse=True)

    visuals = ""
    visual_idx = text.find("## Visual References")
    if visual_idx >= 0:
        visuals = _truncate(text[visual_idx:], 700)

    buffer = [_truncate(prefix, 1300)]
    for score, block in scored:
        if score <= 0 and len(buffer) > 1:
            continue
        candidate = "\n\n".join(buffer + [block, visuals]).strip()
        if len(candidate) > max_chars:
            break
        buffer.append(block)
        if len(buffer) >= 4:
            break
    result = "\n\n".join(buffer).strip()
    if visuals:
        result = f"{result}\n\n{visuals}".strip()
    return _slice_research_bible(result, max_chars)


def _get_llm(
    config: RunnableConfig,
    *,
    json_mode: bool = False,
    temperature: float = 0.15,
) -> ChatOllama:
    conf = Configuration.from_runnable_config(config)
    kwargs: Dict[str, Any] = {
        "base_url": conf.ollama_base_url,
        "model": conf.local_llm,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["format"] = "json"
    return ChatOllama(**kwargs)


def _tavily_search(
    conf: Configuration,
    query: str,
    max_results: int = 4,
    include_images: bool = True,
) -> Dict[str, Any]:
    if TavilyClient is None:
        raise RuntimeError("tavily package is unavailable")
    key = _cache_key("tavily", query, max_results=max_results, include_images=include_images)
    cached = _cache_get(conf, key)
    if isinstance(cached, dict):
        return cached

    client = TavilyClient()
    kwargs: Dict[str, Any] = {"max_results": max_results, "include_raw_content": False}
    if include_images:
        kwargs["include_images"] = True
    try:
        result = client.search(query, **kwargs)
    except TypeError:
        kwargs.pop("include_images", None)
        result = client.search(query, **kwargs)
    _cache_set(conf, key, result)
    return result


def _duckduckgo_search(conf: Configuration, query: str, max_results: int = 4) -> Dict[str, Any]:
    if DDGS is None:
        return {"results": []}
    key = _cache_key("ddg", query, max_results=max_results)
    cached = _cache_get(conf, key)
    if isinstance(cached, dict):
        return cached

    results: List[Dict[str, Any]] = []
    with DDGS() as ddgs:
        for row in list(ddgs.text(query, max_results=max_results)):
            title = row.get("title")
            url = row.get("href")
            content = row.get("body")
            if not title or not url:
                continue
            results.append({"title": title, "url": url, "content": content or ""})
    payload = {"results": results}
    _cache_set(conf, key, payload)
    return payload


def _wikipedia_search(conf: Configuration, query: str, max_results: int = 2) -> List[Dict[str, str]]:
    if wikipedia is None:
        return []
    key = _cache_key("wiki", query, max_results=max_results)
    cached = _cache_get(conf, key)
    if isinstance(cached, list):
        return cached

    rows: List[Dict[str, str]] = []
    try:
        titles = wikipedia.search(query, results=max_results)
    except Exception:
        return rows

    for title in titles[:max_results]:
        if not title:
            continue
        try:
            summary = wikipedia.summary(title, sentences=3, auto_suggest=False, redirect=True)
            page = wikipedia.page(title, auto_suggest=False, preload=False)
            rows.append(
                {
                    "title": str(title),
                    "summary": _truncate(str(summary), 400),
                    "url": str(getattr(page, "url", "")),
                }
            )
        except Exception:
            continue
    _cache_set(conf, key, rows)
    return rows


async def orchestrator(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    topic = str(state.get("topic", "")).strip() or "Offline AI newsroom"
    topic_focus = _extract_topic_focus(topic) or topic
    constraints = _extract_request_constraints(topic)
    orchestrator_timeout = min(
        float(conf.orchestrator_timeout_seconds),
        max(12.0, float(conf.llm_timeout_seconds) * 0.45),
    )
    llm = _get_llm(config, json_mode=True, temperature=0.05)
    payload: Dict[str, Any] = {"sub_topics": []}
    try:
        response = await asyncio.wait_for(
            llm.ainvoke(
                [
                    SystemMessage(content=ORCHESTRATOR_PROMPT.format(topic=topic_focus)),
                    HumanMessage(content=f"Topic:\n{topic_focus}\n\nReturn strict JSON only."),
                ]
            ),
            timeout=orchestrator_timeout,
        )
        payload = _safe_json_loads(response.content, {"sub_topics": []})
    except Exception:
        payload = {"sub_topics": []}
    all_sub_topics = _coerce_sub_topics(topic, payload)
    sub_topics = all_sub_topics[: _target_subtopic_count(int(constraints["target_words"]), conf)]
    writing_brief = {
        "topic_focus": topic_focus,
        "article_intent": str(payload.get("article_intent", "")).strip() or f"Deliver a high-quality article on: {topic_focus}",
        "target_reader": str(payload.get("target_reader", "")).strip() or constraints["audience"] or "technical decision-makers",
        "style_direction": str(payload.get("style_direction", "")).strip() or f"{constraints['tone']}, practical, and engaging",
        "target_words": int(constraints["target_words"]),
        "format": constraints["format"],
        "tone": constraints["tone"],
        "audience": constraints["audience"],
        "keyword": constraints["keyword"],
    }
    return {
        "writing_brief": writing_brief,
        "sub_topics": sub_topics,
        "current_section_index": 0,
        "draft_sections": {},
        "final_article": "",
        "image_candidates": [],
        "logs": [
            f"[ORCHESTRATOR] Planned {len(sub_topics)} sub-topics for article intent: {writing_brief['article_intent']}",
            f"[ORCHESTRATOR] Constraints -> words={writing_brief['target_words']}, tone={writing_brief['tone']}, audience={writing_brief['audience']}, timeout={round(orchestrator_timeout, 1)}s",
        ],
    }


async def research_worker(state: WorkerState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    sub_topic = str(state.get("sub_topic", "")).strip()
    root_topic = _extract_topic_focus(str(state.get("topic", "")).strip()) or str(state.get("topic", "")).strip()
    if not sub_topic:
        return {"gathered_notes": [], "image_candidates": [], "logs": ["[WORKER] Skipped empty sub-topic."]}
    query_text = f"{_compact_search_query(sub_topic, max_terms=8)} {_compact_search_query(root_topic, max_terms=5)}".strip()

    tasks: Dict[str, asyncio.Task[Any]] = {
        "tavily": asyncio.create_task(
            asyncio.to_thread(
                _tavily_search,
                conf,
                query_text,
                int(conf.web_results_per_topic),
                bool(conf.include_images_in_research),
            )
        ),
        "wiki": asyncio.create_task(
            asyncio.to_thread(_wikipedia_search, conf, query_text, int(conf.wiki_results_per_topic))
        ),
    }
    if DDGS is not None:
        tasks["ddg"] = asyncio.create_task(
            asyncio.to_thread(_duckduckgo_search, conf, query_text, int(conf.web_results_per_topic))
        )

    done, pending = await asyncio.wait(
        list(tasks.values()),
        timeout=float(conf.research_task_timeout_seconds),
    )
    for pending_task in pending:
        pending_task.cancel()

    tavily_data: Dict[str, Any] = {"results": []}
    wiki_rows: List[Dict[str, str]] = []
    ddg_data: Dict[str, Any] = {"results": []}

    for name, task in tasks.items():
        if task not in done:
            continue
        try:
            result = task.result()
        except Exception:
            result = None
        if name == "tavily" and isinstance(result, dict):
            tavily_data = result
        elif name == "wiki" and isinstance(result, list):
            wiki_rows = result
        elif name == "ddg" and isinstance(result, dict):
            ddg_data = result

    web_rows = _merge_search_rows(tavily_data, ddg_data, max_items=int(conf.web_results_per_topic))
    web_rows = _filter_search_results_by_topic(web_rows, f"{sub_topic} {root_topic}", max_items=int(conf.web_results_per_topic))

    web_bullets = _format_web_results(web_rows, max_items=int(conf.web_results_per_topic))
    wiki_bullets = _format_wikipedia_results(wiki_rows, max_items=int(conf.wiki_results_per_topic))
    images = _extract_images_from_tavily(tavily_data, max_items=int(conf.image_results_per_topic))

    lines: List[str] = [f"### {sub_topic}", "- Key Web Evidence:"]
    if web_bullets:
        lines.extend([f"  - {line}" for line in web_bullets])
    else:
        lines.append("  - No reliable web results returned.")

    lines.append("- Wikipedia Context:")
    if wiki_bullets:
        lines.extend([f"  - {line}" for line in wiki_bullets])
    else:
        lines.append("  - No relevant Wikipedia summary found.")

    if images:
        lines.append("- Image Candidates:")
        lines.extend([f"  - {url}" for url in images])

    log_line = (
        f"[WORKER] Completed '{sub_topic}' "
        f"(web={len(web_bullets)}, wiki={len(wiki_bullets)}, images={len(images)}, ddg={len(ddg_data.get('results', []))})."
    )
    return {
        "gathered_notes": ["\n".join(lines)],
        "image_candidates": images,
        "logs": [log_line],
    }


async def synthesizer(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    notes = state.get("gathered_notes", []) or []
    images = state.get("image_candidates", []) or []
    writing_brief = state.get("writing_brief", {}) or {}

    deduped_notes: List[str] = []
    seen_notes = set()
    for note in notes:
        text = str(note or "").strip()
        if text and text not in seen_notes:
            seen_notes.add(text)
            deduped_notes.append(text)

    deduped_images: List[str] = []
    seen_images = set()
    for image in images:
        url = str(image or "").strip()
        if url and url not in seen_images:
            seen_images.add(url)
            deduped_images.append(url)

    compact_notes = [_compress_research_note(note) for note in deduped_notes]
    compact_notes = [note for note in compact_notes if note]

    brief_lines = [
        f"- Intent: {writing_brief.get('article_intent', 'N/A')}",
        f"- Target reader: {writing_brief.get('target_reader', 'N/A')}",
        f"- Style: {writing_brief.get('style_direction', 'N/A')}",
    ]
    visual_lines = [f"- {url}" for url in deduped_images[:8]] or ["- No reliable image candidates were found."]

    research_bible = (
        "# Research Bible\n\n"
        "## Topic Context\n"
        f"{state.get('topic', '')}\n\n"
        "## Writing Brief\n"
        f"{chr(10).join(brief_lines)}\n\n"
        "## Evidence Digest\n"
        f"{chr(10).join(compact_notes) if compact_notes else '- No research notes collected.'}\n\n"
        "## Visual References\n"
        f"{chr(10).join(visual_lines)}"
    ).strip()
    research_bible = _slice_research_bible(research_bible, int(conf.max_research_bible_chars))

    return {
        "research_bible": research_bible,
        "image_candidates": deduped_images[: int(conf.max_images_per_article) * 3],
        "logs": [f"[SYNTHESIZER] Compiled research bible (notes={len(compact_notes)}, images={len(deduped_images)})."],
    }


async def planner(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    topic = str(state.get("topic", "")).strip()
    research_bible = _slice_research_bible(
        str(state.get("research_bible", "")).strip(),
        min(int(conf.max_research_bible_chars), 7000),
    )
    sub_topics = state.get("sub_topics", []) or []
    writing_brief = state.get("writing_brief", {}) or {}
    topic_focus = str(writing_brief.get("topic_focus", "")).strip() or _extract_topic_focus(topic) or topic
    desired_words = int(writing_brief.get("target_words", 900) or 900)
    planner_timeout = min(
        float(conf.planner_timeout_seconds),
        max(15.0, float(conf.llm_timeout_seconds) * 0.55),
    )

    llm = _get_llm(config, json_mode=True, temperature=0.05)
    payload = {"title": topic, "outline": []}
    try:
        response = await asyncio.wait_for(
            llm.ainvoke(
                [
                    SystemMessage(content=PLANNER_PROMPT),
                    HumanMessage(
                        content=(
                            f"Topic:\n{topic_focus}\n\n"
                            f"Writing Brief:\n{json.dumps(writing_brief, ensure_ascii=True)}\n\n"
                            f"Research Bible:\n{research_bible}\n\n"
                            "Return strict JSON object with keys: title, outline."
                        )
                    ),
                ]
            ),
            timeout=planner_timeout,
        )
        payload = _safe_json_loads(response.content, {"title": topic, "outline": []})
    except Exception:
        payload = {"title": topic, "outline": []}
    outline = _normalize_outline(
        payload.get("outline", []),
        sub_topics,
        desired_total_words=desired_words,
        article_topic=topic_focus,
    )
    return {
        "outline": outline,
        "current_section_index": 0,
        "logs": [f"[PLANNER] Built outline with {len(outline)} sections (target_words={desired_words}, timeout={round(planner_timeout, 1)}s)."],
    }


async def writer(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    outline = state.get("outline", []) or []
    index = int(state.get("current_section_index", 0))
    if index >= len(outline):
        return {"logs": ["[WRITER] Draft loop complete."]}

    section = outline[index]
    section_title = str(section.get("title", f"Section {index + 1}")).strip()
    guidelines = str(section.get("guidelines", "Be specific and technical.")).strip()
    evidence_hint = str(section.get("evidence_hint", "Use concrete findings from research sources.")).strip()
    target_words = int(section.get("word_count", 0) or 0)
    drafts = dict(state.get("draft_sections", {}))
    previous = drafts.get(index - 1, "")
    previous_tail = _tail_sentences(previous)
    writing_brief = state.get("writing_brief", {}) or {}
    topic_focus = str(writing_brief.get("topic_focus") or _extract_topic_focus(str(state.get("topic", ""))) or state.get("topic", "")).strip()
    primary_keyword = str(writing_brief.get("keyword", "")).strip()
    if target_words <= 0:
        fallback_words = int(writing_brief.get("target_words", 900) or 900)
        section_count = max(1, len(outline))
        target_words = max(140, min(320, round(fallback_words / section_count)))

    image_candidates = [str(url).strip() for url in (state.get("image_candidates", []) or []) if str(url).strip()]

    llm = _get_llm(config, json_mode=False, temperature=0.24)
    section_body = ""
    used_fallback = False
    used_rewrite = False
    writer_error = ""
    base_writer_timeout = min(
        float(conf.writer_section_timeout_seconds),
        max(20.0, float(conf.llm_timeout_seconds)),
    )
    for attempt, max_chars in enumerate((min(int(conf.max_research_bible_chars), 2800), 1500), start=1):
        research_bible = _extract_relevant_research_slice(
            str(state.get("research_bible", "")).strip(),
            section_title=section_title,
            evidence_hint=evidence_hint,
            max_chars=max_chars,
        )
        attempt_timeout = base_writer_timeout if attempt == 1 else max(16.0, base_writer_timeout * 0.35)
        try:
            response = await asyncio.wait_for(
                llm.ainvoke(
                    [
                        SystemMessage(content=WRITER_PROMPT.format(i=index + 1, prev=previous_tail or "N/A")),
                        HumanMessage(
                            content=(
                                f"Topic:\n{topic_focus}\n\n"
                                f"Writing brief:\n{json.dumps(writing_brief, ensure_ascii=True)}\n\n"
                                f"Section title: {section_title}\n"
                                f"Target words: {target_words}\n"
                                f"Guidelines: {guidelines}\n"
                                f"Evidence hint: {evidence_hint}\n\n"
                                f"Previous section tail:\n{previous_tail or 'N/A'}\n\n"
                                f"Image candidates:\n{chr(10).join(image_candidates[:4]) or 'N/A'}\n\n"
                                f"Research Bible:\n{research_bible}\n\n"
                                "Write only this section in markdown paragraphs."
                            )
                        ),
                    ]
                ),
                timeout=attempt_timeout,
            )
            section_body = strip_thinking_tokens(str(response.content or "").strip())
            if section_body:
                break
        except Exception as exc:
            writer_error = str(exc)
            if attempt == 2:
                section_body = ""

    if not section_body.strip():
        used_fallback = True
        section_body = _fallback_section_text(
            topic=str(state.get("topic", "")),
            audience=str(writing_brief.get("audience") or writing_brief.get("target_reader") or ""),
            tone=str(writing_brief.get("tone") or writing_brief.get("style_direction") or ""),
            section_title=section_title,
            guidelines=guidelines,
            evidence_hint=evidence_hint,
            research_slice=str(state.get("research_bible", "")).strip(),
            target_words=target_words,
        )

    section_body = _sanitize_writer_output(section_body)

    # If section content is generic or drifting, force one strict rewrite before fallback.
    if not used_fallback and _is_generic_or_drifting(section_body, topic_focus, primary_keyword):
        rewrite_prompt = (
            "Rewrite this section to make it high-quality, human, and fully on-topic.\n"
            "Rules:\n"
            "- Stay strictly on the provided topic and section objective.\n"
            "- Remove generic filler, repetition, and robotic transitions.\n"
            "- Use concrete examples or evidence language where possible.\n"
            "- Keep tone natural, expert, and user-friendly.\n"
            "- Keep markdown heading and paragraph style.\n"
            "- Do not add unrelated claims or invented facts.\n"
            "- End with a specific insight, not a generic sentence."
        )
        try:
            rewrite_response = await asyncio.wait_for(
                llm.ainvoke(
                    [
                        SystemMessage(content=rewrite_prompt),
                        HumanMessage(
                            content=(
                                f"Topic lock: {topic_focus}\n"
                                f"Primary keyword: {primary_keyword or 'N/A'}\n"
                                f"Section title: {section_title}\n"
                                f"Target words: {target_words}\n\n"
                                f"Current section draft:\n{section_body}\n\n"
                                "Return only the rewritten section body in markdown paragraphs."
                            )
                        ),
                    ]
                ),
                timeout=float(conf.llm_timeout_seconds),
            )
            rewritten = _sanitize_writer_output(strip_thinking_tokens(str(rewrite_response.content or "").strip()))
            if rewritten:
                section_body = rewritten
                used_rewrite = True
        except Exception as exc:
            writer_error = writer_error or str(exc)

    if _is_generic_or_drifting(section_body, topic_focus, primary_keyword):
        used_fallback = True
        section_body = _fallback_section_text(
            topic=str(state.get("topic", "")),
            audience=str(writing_brief.get("audience") or writing_brief.get("target_reader") or ""),
            tone=str(writing_brief.get("tone") or writing_brief.get("style_direction") or ""),
            section_title=section_title,
            guidelines=guidelines,
            evidence_hint=evidence_hint,
            research_slice=str(state.get("research_bible", "")).strip(),
            target_words=target_words,
        )

    section_body = _sanitize_writer_output(section_body)
    section_body = _clip_to_word_count(section_body, target_words=target_words, max_ratio=1.35)
    section_body = re.sub(rf"(?im)^\s*##\s*{re.escape(section_title)}\s*$", "", section_body).strip()
    section_body = re.sub(rf"(?im)^\s*{re.escape(section_title)}\s*$", "", section_body).strip()
    section_body = f"## {section_title}\n\n{section_body}".strip()

    existing_images = sum(_count_markdown_images(text) for text in drafts.values())
    if (
        conf.include_images_in_article
        and image_candidates
        and existing_images < int(conf.max_images_per_article)
        and _count_markdown_images(section_body) == 0
    ):
        image_url = image_candidates[index % len(image_candidates)]
        if _image_looks_relevant(image_url, topic_focus, section_title, primary_keyword):
            section_body = _inject_markdown_image(section_body, section_title, image_url)

    section_body = _sanitize_final_article(section_body, topic_focus, primary_keyword, ensure_h1=False)

    drafts[index] = section_body
    quality_tag = "fallback" if used_fallback else ("rewrite" if used_rewrite else "llm")
    error_suffix = f" | error={_truncate(writer_error, 160)}" if used_fallback and writer_error else ""
    return {
        "draft_sections": drafts,
        "current_section_index": index + 1,
        "logs": [f"[WRITER] Drafted section {index + 1}/{len(outline)} ({quality_tag}): {section_title}{error_suffix}"],
    }


async def editor(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    conf = Configuration.from_runnable_config(config)
    ordered_sections = _sorted_section_items(state.get("draft_sections", {}))
    raw_draft = "\n\n".join(ordered_sections).strip()
    if not raw_draft:
        return {"final_article": "", "logs": ["[EDITOR] No draft to polish."]}
    writing_brief = state.get("writing_brief", {}) or {}
    topic_focus = str(writing_brief.get("topic_focus") or _extract_topic_focus(str(state.get("topic", ""))) or state.get("topic", "")).strip()
    primary_keyword = str(writing_brief.get("keyword", "")).strip()
    editor_timeout = min(
        float(conf.editor_timeout_seconds),
        max(20.0, float(conf.llm_timeout_seconds) * 0.7),
    )

    llm = _get_llm(config, json_mode=False, temperature=0.15)
    polished = ""
    used_humanize = False
    try:
        response = await asyncio.wait_for(
            llm.ainvoke(
                [
                    SystemMessage(content=EDITOR_PROMPT),
                    HumanMessage(content=raw_draft),
                ]
            ),
            timeout=editor_timeout,
        )
        polished = strip_thinking_tokens(str(response.content or "").strip())
    except Exception:
        polished = raw_draft
    final_article = polished or raw_draft

    if _looks_robotic(final_article):
        try:
            humanized = await asyncio.wait_for(
                llm.ainvoke(
                    [
                        SystemMessage(content=HUMANIZE_PROMPT),
                        HumanMessage(content=final_article),
                    ]
                ),
                timeout=max(16.0, editor_timeout * 0.6),
            )
            rewritten = _sanitize_writer_output(strip_thinking_tokens(str(humanized.content or "").strip()))
            if rewritten:
                final_article = rewritten
                used_humanize = True
        except Exception:
            pass

    final_article = _sanitize_final_article(final_article, topic_focus, primary_keyword)
    target_words = int(writing_brief.get("target_words", 900) or 900)
    final_article = _clip_to_word_count(final_article, target_words=target_words, max_ratio=1.25)

    if (not _text_mentions_topic(final_article, topic_focus, primary_keyword)) and _has_off_topic_markers(final_article):
        final_article = raw_draft
    if len(final_article.split()) < 120 and len(raw_draft.split()) > len(final_article.split()):
        final_article = raw_draft
    final_article = _sanitize_final_article(final_article, topic_focus, primary_keyword)
    logs: List[str] = []
    if used_humanize:
        logs.append("[HUMANIZE] Applied human-voice polish pass.")
    logs.append(f"[EDITOR] Finalized article ({len(final_article.split())} words, humanized={'yes' if used_humanize else 'no'}).")
    return {
        "final_article": final_article,
        "logs": logs,
    }
