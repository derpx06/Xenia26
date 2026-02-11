# Agent Architecture Overhaul — Walkthrough

## What Changed

6 files touched (1 new, 5 modified) implementing the 10-point fix + user refinements:

| File | Change |
|:---|:---|
| [intent_router.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/intent_router.py) | **NEW** — LLM-driven intent classifier & topic extractor with knowledge confidence check |
| [schemas.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/schemas.py) | Added `intent_category`, `topic_lock`, `search_keywords`, `needs_search`, `direct_response` to state |
| [config.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/config.py) | Lowered temps (email 0.5, linkedin/twitter 0.55), added 74 `COMMON_TOPICS` |
| [graph.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/graph.py) | Intent router as new entry point → conditional edge to `direct_response` or `supervisor` |
| [nodes.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/nodes.py) | Scribe enforces `TOPIC_LOCK` + creative personalization; Critic checks hallucination & depth |
| [streaming.py](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/streaming.py) | Emits structured `phase` events: `intent_classified`, `topic_locked`, `search_decision` |

## New Pipeline Flow

```mermaid
graph TD
    A[User Input] --> IR[Intent Router]
    IR -->|"small_talk / system_question"| DR[Direct Response (LLM Generated) → END]
    IR -->|"outreach_task"| SUP[Supervisor]
    SUP --> H[Hunter]
    H -->|"uses search_keywords, skips if needs_search=False"| F[Parallel Analysis]
    F --> D
    D --> G["Scribe (topic_lock + creative personalization)"]
    G --> D
    D --> H["Critic (hallucination check + depth check)"]
    H --> D
    D --> I[END]
```

## User Refinements

1.  **Banned Templates → Creative Personalization**: Removed the hard ban on "I hope you're well". Instead, the model is instructed: *"You may use professional templates... BUT they must be infused with specific context... immediately pivoting to limits tied to the TOPIC_LOCK."*
2.  **LLM Intent Classification**: Replaced hardcoded regex with full LLM classification for better nuance and natural responses to small talk.
3.  **Smart Channel Inference**: The Strategist now intelligently infers channels like WhatsApp/SMS from context. Defaults to Email+LinkedIn+WhatsApp for generic requests.
4.  **Strict Email Structure**: Enforced a 4-part flow for emails (Context -> Intent -> Value -> Action).
5.  **Channel Fine-Tuning**:
    *   **Email**: 120-180 words, deep structure.
    *   **LinkedIn**: 60-120 words, semi-formal, no subject.
    *   **WhatsApp**: 30-70 words, conversational, emoji-friendly.
    *   **SMS**: <40 words, zero fluff.
6.  **Tone Mirroring**: The agent now analyzes prospect content for sentence length, vocabulary complexity, and emoji usage, and mirrors that rhythm.

## Frontend Impact

New SSE event type `phase` is emitted. Example payloads:

```json
{"type": "phase", "content": "intent_classified", "metadata": {"category": "outreach_task"}}
{"type": "phase", "content": "topic_locked", "metadata": {"topic": "Model drift in fraud detection"}}
{"type": "phase", "content": "search_decision", "metadata": {"needs_search": false}}
```

Existing `thought` / `response` / `done` types remain unchanged.
