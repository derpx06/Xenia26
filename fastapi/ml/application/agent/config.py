from ml.settings import settings
import os

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

CHANNEL_RULES = {
    "email": "Subject line required. 3-7 words, attention-grabbing, specific. Must include company or interest keyword. <=120 words. Professional but warm. Personalize with recipient details.",
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
