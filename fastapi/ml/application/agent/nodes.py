import instructor
import asyncio
from langchain_ollama import ChatOllama
from loguru import logger
from ml.settings import settings
from .schemas import (
    AgentState, ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult, ChannelType
)
from ..crawlers.dispatcher import CrawlerDispatcher
import openai

# --- Configuration ---
LOGIC_MODEL = settings.LLM_MODEL
CREATIVE_MODEL = settings.LLM_MODEL 

# Setup Structured LLM Clients
try:
    llm_client = instructor.from_openai(
        openai.OpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama",
        ),
        mode=instructor.Mode.JSON,
    )
    llm_creative = ChatOllama(model=CREATIVE_MODEL, temperature=0.7)
except Exception as e:
    logger.error(f"Failed to initialize LLM clients: {e}. Ensure Ollama is running.")
    raise

# --- Node 1: HUNTER (Smart - Skips if no URL) ---
async def hunter_node(state: AgentState) -> AgentState:
    logger.info("👻 HUNTER: Checking inputs...")
    url = state.get("target_url")
    logs = state.get("logs", [])
    
    # General Action Bypass: If no URL is provided, skip research.
    # Also handle "string" which might be passed by default in some test cases
    if not url or url == "string" or "http" not in url:
        logs.append("👻 HUNTER: No valid URL provided. Switching to General Mode.")
        return {
            "prospect": ProspectProfile(
                name="User", role="General", company="General", raw_bio=""
            ),
            "logs": logs
        }
    
    try:
        logs.append(f"👻 HUNTER: Analyzing {url}...")
        dispatcher = CrawlerDispatcher()
        
        # NOTE: get_crawler is Synchronous
        crawler = dispatcher.get_crawler(url) 
        
        # Check for async extraction or crawl
        if hasattr(crawler, 'aextract'):
            crawl_result = await crawler.aextract(url)
        elif asyncio.iscoroutinefunction(crawler.crawl):
            crawl_result = await crawler.crawl(url)
        else:
             # Fallback for sync crawl if any
            crawl_result = crawler.crawl(url)
        
        raw_text = crawl_result.markdown if hasattr(crawl_result, 'markdown') else str(crawl_result)
        truncated_text = raw_text[:6000] 
        
        # 2. Extract structured facts using Instructor
        logger.info("👻 HUNTER: Extracting signals...")
        profile = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=ProspectProfile,
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert lead researcher. Extract key facts. If bio is missing, make best guess from context or leave generic."
                },
                {
                    "role": "user", 
                    "content": f"Analyze this profile and extract the schema:\n\n{truncated_text}"
                }
            ],
            max_retries=2
        )
        logs.append(f"👻 HUNTER: Found {profile.name} at {profile.company}")
        return {"prospect": profile, "logs": logs}
        
    except Exception as e:
        logger.error(f"Hunter failed: {e}")
        logs.append(f"👻 HUNTER: Failed to scrape ({str(e)}). Using placeholder.")
        return {
            "prospect": ProspectProfile(
                name="Prospect", role="Professional", company="Target Company", 
                recent_activity=[], raw_bio=""
            ),
            "logs": logs
        }

# --- Node 2: PROFILER (Smart Default) ---
def profiler_node(state: AgentState) -> AgentState:
    logger.info("🧠 PROFILER: Analyzing personality...")
    prospect: ProspectProfile = state.get("prospect")
    logs = state.get("logs", [])
    
    # If generic prospect (General Mode), use neutral profile
    if prospect.name == "User" and not prospect.raw_bio:
        logs.append("🧠 PROFILER: General Mode detected. Using helpful persona.")
        return {
            "psych": PsychProfile(
                disc_type="C", # Conscientious/Helpful
                communication_style="Helpful and Direct", 
                tone_instructions=["Be helpful", "Be clear", "No fluff", "Provide value"]
            ),
            "logs": logs
        }
    
    try:
        profile = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=PsychProfile,
            messages=[
                {"role": "system", "content": "You are a behavioral psychologist using the DISC framework. Analyze text for tone, sentence length, and word choice."},
                {"role": "user", "content": f"Analyze this writing style:\n\n{prospect.raw_bio[:2000]}\n\nDetermine their personality."}
            ]
        )
        logs.append(f"🧠 PROFILER: Identified as Type {profile.disc_type} ({profile.communication_style})")
        return {"psych": profile, "logs": logs}
    except Exception as e:
        logger.error(f"Profiler failed: {e}")
        return {
            "psych": PsychProfile(
                disc_type="C", communication_style="Professional", tone_instructions=["Be polite"]
            ),
            "logs": logs
        }

# --- Node 3: THE STRATEGIST (Channel Logic) ---
def strategist_node(state: AgentState) -> AgentState:
    """
    Decides the Channel based on user instruction.
    """
    logger.info("♟️ STRATEGIST: Planning attack...")
    prospect: ProspectProfile = state["prospect"]
    # Handle missing psych profile (General Mode)
    psych: PsychProfile = state.get("psych") or PsychProfile(
        disc_type="C", 
        communication_style="Professional", 
        tone_instructions=["Be helpful"]
    )
    instruction = state["user_instruction"]
    logs = state.get("logs", [])
    
    try:
        strategy = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=StrategyBrief,
            messages=[
                {
                    "role": "system", 
                    "content": """
                    You are a Strategic Planner. Determine the Target Channel from the instruction.
                    
                    DECISION LOGIC:
                    1. 'email': If user wants to sell/pitch/contact someone specific.
                    2. 'linkedin_post': If user wants public content/viral posts.
                    3. 'whatsapp': If user wants casual/direct text messages.
                    4. 'twitter_thread': If user wants short, threaded content.
                    5. 'research_report': If user wants deep analysis of a company/url.
                    6. 'general_response': If user asks a question, wants a summary, or just wants to chat.
                    """
                },
                {
                    "role": "user", 
                    "content": f"""
                    INSTRUCTION: "{instruction}"
                    TARGET: {prospect.role} at {prospect.company}
                    PSYCH: {psych.disc_type}
                    
                    Task: Create a StrategyBrief.
                    """
                }
            ]
        )
        logs.append(f"♟️ STRATEGIST: Channel = {strategy.target_channel}. Goal: {strategy.goal}")
        return {"strategy": strategy, "logs": logs}
    except Exception as e:
        logger.error(f"Strategist failed: {e}")
        # Fallback
        return {
            "strategy": StrategyBrief(
                target_channel="general_response",
                goal="Answer user",
                hook="None",
                key_points=[],
                framework="Direct",
                cta="None"
            ),
            "logs": logs
        }

# --- Node 4: THE SCRIBE (Multi-Channel) ---
def scribe_node(state: AgentState) -> AgentState:
    """
    Writes the content based on channel and strategy.
    """
    logger.info("✍️ SCRIBE: Drafting content...")
    strategy: StrategyBrief = state["strategy"]
    psych: PsychProfile = state.get("psych") or PsychProfile(
        disc_type="C", 
        communication_style="Professional", 
        tone_instructions=["Be clear"]
    )
    critique: CritiqueResult = state.get("latest_critique")
    drafts = state.get("drafts", [])
    logs = state.get("logs", [])
    
    # --- Channel Rules ---
    if strategy.target_channel == "email":
        rules = "Format: Subject + Body. <150 words. Professional. Clean spacing."
    elif strategy.target_channel == "linkedin_post":
        rules = "Format: Viral structure. Short punchy lines. Hashtags at end. No 'Dear Sir'."
    elif strategy.target_channel == "whatsapp":
        rules = "Format: Single message. Very casual. No subject line. Short."
    elif strategy.target_channel == "twitter_thread":
        rules = "Format: Thread of 3-5 tweets. Numbered 1/5, 2/5 etc. Under 280 chars per tweet."
    elif strategy.target_channel == "research_report":
        rules = "Format: Markdown Report. Headers, bullet points, data-heavy. Comprehensive."
    elif strategy.target_channel == "general_response":
        rules = "Format: Conversational direct answer. Helpful. Markdown supported. No sales format."
    else:
        rules = "Format: Standard professional text."

    prompt = f"""
    You are an expert AI writer.
    
    TASK: {state['user_instruction']}
    CHANNEL: {strategy.target_channel}
    GOAL: {strategy.goal}
    
    BLUEPRINT:
    - Hook: {strategy.hook}
    - Key Points: {', '.join(strategy.key_points)}
    - CTA: {strategy.cta}
    
    RULES:
    {rules}
    
    TONE:
    {psych.communication_style}
    Instructions: {', '.join(psych.tone_instructions)}
    
    Output ONLY the content.
    """
    
    if critique and not critique.passed:
        logger.info(f"✍️ SCRIBE: Rewriting. Feedback: {critique.feedback}")
        prompt += f"\n\nFIX PREVIOUS ERROR: {critique.feedback}"

    response = llm_creative.invoke(prompt)
    content = response.content
    
    logs.append("✍️ SCRIBE: Draft generated.")
    return {
        "drafts": drafts + [content], 
        "revision_count": state.get("revision_count", 0) + 1,
        "final_output": content,
        "logs": logs
    }

# --- Node 5: THE CRITIC (Relaxed for General) ---
def critic_node(state: AgentState) -> AgentState:
    """
    Evaluates the draft. Auto-approves general responses.
    """
    logger.info("⚖️ CRITIC: Judging work...")
    strategy = state["strategy"]
    latest_draft = state["drafts"][-1]
    # Handle missing psych profile (General Mode)
    psych: PsychProfile = state.get("psych") or PsychProfile(
        disc_type="C", 
        communication_style="Professional", 
        tone_instructions=["Be clear"]
    )
    logs = state.get("logs", [])
    
    # Bypass criticism for general chat to speed it up
    if strategy.target_channel == "general_response":
        logs.append("⚖️ CRITIC: General response auto-approved.")
        return {
            "latest_critique": CritiqueResult(score=10, feedback="Pass", passed=True),
            "logs": logs
        }
        
    try:
        critique = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=CritiqueResult,
            messages=[
                {
                    "role": "system", 
                    "content": "You are a ruthless editor. Grade 1-10. Fail generic inputs."
                },
                {
                    "role": "user", 
                    "content": f"""
                    TARGET STRATEGY:
                    Channel: {strategy.target_channel}
                    Hook: {strategy.hook}
                    Tone: {psych.communication_style}
                    
                    DRAFT:
                    {latest_draft}
                    
                    Evaluate:
                    1. Fit for channel?
                    2. Uses hook?
                    3. Human tone?
                    """
                }
            ]
        )
        logs.append(f"⚖️ CRITIC: Score {critique.score}/10. Passed: {critique.passed}")
        return {"latest_critique": critique, "logs": logs}
        
    except Exception as e:
        logger.error(f"Critic failed: {e}")
        return {
            "latest_critique": CritiqueResult(score=10, feedback="Critic offline", passed=True),
            "logs": logs
        }