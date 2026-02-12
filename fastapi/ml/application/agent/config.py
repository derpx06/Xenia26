from ml.settings import settings
import os

LOGIC_MODEL = settings.LLM_LOGIC_MODEL
CREATIVE_MODEL = settings.LLM_CREATIVE_MODEL
OFFLINE_STRICT = os.getenv("OFFLINE_STRICT", "true").lower() == "true"

CHANNEL_TEMPS = {
    "email": 0.5,
    "linkedin_dm": 0.5,
    "linkedin_post": 0.55,
    "whatsapp": 0.4,
    "sms": 0.3,
    "twitter_thread": 0.55,
    "research_report": 0.35,
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
    "email": "120-180 words. Structure: Context -> Intent -> Value -> CTA. Explain why it matters. No generic openings.",
    "linkedin_dm": "60-120 words. Semi-formal. Direct reference to recent activity. No long intro. No email-like structure. Professional but conversational.",
    "linkedin_post": "Hook + insight + CTA. Use 2-3 hashtags. Keep concise.",
    "whatsapp": "30-70 words. Direct, conversational. Short sentences. One core idea. One CTA. No paragraph blocks. Feel like a real person.",
    "sms": "20-40 words. ZERO fluff. One idea. One action. No intro. Straight to value.",
    "twitter_thread": "Hook tweet + 1-2 value tweets + CTA tweet. Punchy.",
    "research_report": "Structured markdown report with clear sections, facts first, no fluff, include concise recommendations.",
    "instagram_dm": "Friendly, visual language. 2 sentences max.",
    "general_response": "Clear, helpful answer. Markdown OK."
}

CHANNEL_MAX_TOKENS = {
    "email": 260,
    "linkedin_dm": 170,
    "linkedin_post": 220,
    "whatsapp": 100,
    "sms": 60,
    "twitter_thread": 240,
    "research_report": 420,
    "instagram_dm": 120,
    "general_response": 210,
}

# --- NEW: Common topics for knowledge confidence check (Point 3) ---
COMMON_TOPICS = {
    # ML / AI
    "machine learning", "deep learning", "neural network", "model drift",
    "fraud detection", "natural language processing", "nlp", "computer vision",
    "reinforcement learning", "transformer", "llm", "large language model",
    "generative ai", "recommendation system", "classification", "regression",
    "clustering", "anomaly detection", "feature engineering", "data pipeline",
    "mlops", "model deployment", "a/b testing", "embeddings",
    # Business / FinTech
    "fintech", "saas", "b2b", "b2c", "startup", "venture capital",
    "product management", "growth hacking", "customer acquisition",
    "sales funnel", "lead generation", "content marketing", "seo",
    "digital marketing", "social media marketing", "email marketing",
    "crm", "erp", "supply chain", "logistics", "e-commerce",
    # Software Engineering
    "microservices", "api design", "cloud computing", "devops",
    "kubernetes", "docker", "ci/cd", "database", "sql", "nosql",
    "distributed systems", "scalability", "performance optimization",
    "backend", "frontend", "full stack", "mobile development",
    # General
    "cybersecurity", "blockchain", "iot", "data analytics",
    "business intelligence", "data science", "data engineering",
    "charity", "nonprofit", "education", "healthcare", "real estate",
}
