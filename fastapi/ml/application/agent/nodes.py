import instructor
import asyncio
from langchain_ollama import ChatOllama
from loguru import logger
from ml.settings import settings
from .schemas import (
    AgentState, ProspectProfile, PsychProfile, StrategyBrief, CritiqueResult, ChannelType
)
from .knowledge import SimpleKnowledgeBase
from .writing_style_inferrer import infer_style_rules
from agent_style_transfer.schemas import Document
from ..crawlers.dispatcher import CrawlerDispatcher
import openai

# --- Configuration ---
LOGIC_MODEL = settings.LLM_MODEL
CREATIVE_MODEL = settings.LLM_MODEL 

# Initialize Knowledge Base
kb = SimpleKnowledgeBase()

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

# --- Node 1: HUNTER (Smart - KB First, then Scrape) ---
async def hunter_node(state: AgentState) -> AgentState:
    logger.info("👻 HUNTER: Checking inputs...")
    url = state.get("target_url")
    logs = state.get("logs", [])
    
    # 1. Check for valid URL
    if not url or url == "string" or "http" not in url:
        logs.append("👻 HUNTER: No valid URL provided. Switching to General Mode.")
        return {
            "prospect": ProspectProfile(
                name="User", role="General", company="General", raw_bio=""
            ),
            "logs": logs
        }
    
    # 2. Check Knowledge Base
    # Simple extraction of name/company from URL is hard without scraping, 
    # so we might check if we have visited this URL before if we indexed by URL.
    # For now, we'll proceed to scrape. 
    # TODO: Implement URL-based lookup in KB if needed.
    
    try:
        logs.append(f"👻 HUNTER: Analyzing {url}...")
        dispatcher = CrawlerDispatcher()
        crawler = dispatcher.get_crawler(url) 
        
        # Async/Sync Crawl
        if hasattr(crawler, 'aextract'):
            crawl_result = await crawler.aextract(url)
        elif asyncio.iscoroutinefunction(crawler.crawl):
            crawl_result = await crawler.crawl(url)
        else:
            crawl_result = crawler.crawl(url)
        
        raw_text = crawl_result.markdown if hasattr(crawl_result, 'markdown') else str(crawl_result)
        truncated_text = raw_text[:3500] 
        
        # 3. Extract structured facts using Instructor
        logger.info("👻 HUNTER: Extracting signals...")
        profile = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=ProspectProfile,
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert lead researcher. Extract key facts. Keep bio concise."
                },
                {
                    "role": "user", 
                    "content": f"Extract schema from this text:\n\n{truncated_text}"
                }
            ],
            max_retries=2
        )
        
        # 4. Save to KB
        kb.save_prospect(profile)
        
        logs.append(f"👻 HUNTER: Found {profile.name} at {profile.company}. Saved to Knowledge Base.")
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

# --- Node 2: PROFILER (Deep Style Inference) ---
def profiler_node(state: AgentState) -> AgentState:
    logger.info("🧠 PROFILER: Analyzing personality & style...")
    prospect: ProspectProfile = state.get("prospect")
    logs = state.get("logs", [])
    
    # Check KB for existing psych profile? (Optional optimization)
    
    if (prospect.name == "User" or prospect.name == "Prospect") and not prospect.raw_bio:
        logs.append("🧠 PROFILER: General Mode detected. Using helpful persona.")
        return {
            "psych": PsychProfile(
                disc_type="C",
                communication_style="Helpful and Direct", 
                tone_instructions=["Be helpful", "Be clear", "No fluff"],
                style_rules=[]
            ),
            "logs": logs
        }
    
    # Check KB for existing psych profile to save time/cost
    cached_psych_data = kb.get_psych_profile(prospect.name, prospect.company)
    if cached_psych_data:
        logs.append("🧠 PROFILER: Found existing psych profile in KB. Skipping analysis.")
        return {"psych": PsychProfile(**cached_psych_data), "logs": logs}
    
    try:
        # 1. Text Analysis for DISC/Tone
        profile = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=PsychProfile,
            messages=[
                {"role": "system", "content": "You are a behavioral psychologist. Analyze text for tone. Keep it brief."},
                {"role": "user", "content": f"Analyze this writing style:\n\n{prospect.raw_bio[:1500]}\n\nDetermine their personality."}
            ]
        )
        
        # 2. Advanced Style Inference using existing module
        # Create a transient Document object for analysis
        if prospect.raw_bio:
            doc = Document(content=prospect.raw_bio, title=f"{prospect.name} Bio")
            style_rules = infer_style_rules([doc], provider="ollama", model=LOGIC_MODEL)
            profile.style_rules = style_rules
            logs.append(f"🧠 PROFILER: Extracted {len(style_rules)} custom style rules.")
        
        # Save to KB for future use
        kb.save_psych_profile(prospect.name, prospect.company, profile)
        
        logs.append(f"🧠 PROFILER: Identified as Type {profile.disc_type} ({profile.communication_style})")
        return {"psych": profile, "logs": logs}
    except Exception as e:
        logger.error(f"Profiler failed: {e}")
        return {
            "psych": PsychProfile(
                disc_type="C", communication_style="Professional", 
                tone_instructions=["Be polite"], style_rules=[]
            ),
            "logs": logs
        }

# --- Node 3: THE STRATEGIST (Multi-Channel Logic) ---
def strategist_node(state: AgentState) -> AgentState:
    """
    Decides the Channel(s) based on user instruction.
    """
    logger.info("♟️ STRATEGIST: Planning attack...")
    prospect: ProspectProfile = state["prospect"]
    psych: PsychProfile = state.get("psych")
    instruction = state["user_instruction"]
    history = state.get("conversation_history", [])
    logs = state.get("logs", [])
    
    # Context string from history (last 3 messages)
    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-3:]]) if history else "No history."

    try:
        strategy = llm_client.chat.completions.create(
            model=LOGIC_MODEL,
            response_model=StrategyBrief,
            messages=[
                {
                    "role": "system", 
                    "content": """
                    You are a Strategic Planner. Determine the Target Channel(s) from the instruction.
                    If the user asks for "outreach" or "contact", consider Email + LinkedIn.
                    If the user specifies a channel, use that.
                    
                    Available Channels:
                    - email: For formal business pitches.
                    - linkedin_dm: For professional networking.
                    - linkedin_post: For public engagement.
                    - whatsapp/sms: For casual/direct contact (use only if requested).
                    - twitter_thread: For content marketing.
                    - general_response: For answering questions or clarifications.
                    """
                },
                {
                    "role": "user", 
                    "content": f"""
                    INSTRUCTION: "{instruction}"
                    CONTEXT: {history_context}
                    TARGET: {prospect.role} at {prospect.company}
                    
                    Task: Create a StrategyBrief. Select appropriate target_channels.
                    """
                }
            ]
        )
        
        # Ensure target_channels is populated
        if not strategy.target_channels:
            strategy.target_channels = [strategy.target_channel]
            
        logs.append(f"♟️ STRATEGIST: Channels = {strategy.target_channels}. Goal: {strategy.goal}")
        return {"strategy": strategy, "logs": logs}
    except Exception as e:
        logger.error(f"Strategist failed: {e}")
        return {
            "strategy": StrategyBrief(
                target_channels=["general_response"],
                target_channel="general_response",
                goal="Answer user",
                hook="None",
                key_points=[],
                framework="Direct",
                cta="None"
            ),
            "logs": logs
        }

# --- Node 4: THE SCRIBE (Looping Writer) ---
def scribe_node(state: AgentState) -> AgentState:
    """
    Writes content for ALL selected channels.
    """
    logger.info("✍️ SCRIBE: Drafting content...")
    strategy: StrategyBrief = state["strategy"]
    prospect: ProspectProfile = state["prospect"]
    psych: PsychProfile = state.get("psych")
    critique: CritiqueResult = state.get("latest_critique")
    
    current_drafts = state.get("drafts", {})
    history = state.get("conversation_history", [])
    logs = state.get("logs", [])
    
    # Context string from history
    history_context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-5:]]) if history else "No previous conversation."
    
    # Fetch similar successful outreach from KB (Vector Search)
    # We construct a query to find semantically similar past scenarios
    query_text = f"Outreach to {prospect.role} in {prospect.company} regarding {strategy.goal}"
    similar_outreach = kb.get_similar_outreach(query_text=query_text, role=prospect.role, limit=2)
    
    kb_context = ""
    if similar_outreach:
        # Deduplicate content to avoid repetition in prompt
        unique_examples = list(set([ex['content'] for ex in similar_outreach]))
        kb_context = "SUCCESSFUL PAST EXAMPLES (Use these as inspiration):\n" + "\n---\n".join(unique_examples)
    
    new_drafts = current_drafts.copy()
    
    for channel in strategy.target_channels:
        # Skip if already drafted and valid (unless critiqued)
        if channel in new_drafts and critique and critique.passed:
            continue
            
        # Define Channel Rules
        if channel == "email":
            rules = "Subject Line required. <150 words. Professional but personal."
        elif channel in ["linkedin_post", "twitter_thread"]:
            rules = "Viral structure. Hook + Value + CTA. Use hashtags."
        elif channel in ["whatsapp", "sms"]:
            rules = "Extremely short. <30 words. Casual. No subject."
        elif channel == "linkedin_dm":
            rules = "No subject. Conversational. Ask for permission/connection."
        elif channel == "general_response":
            rules = "Helpful direct answer. Markdown allowed."
        else:
            rules = "Standard professional text."

        comments = f"FIX ERROR: {critique.feedback}" if (critique and not critique.passed) else ""

        prompt = f"""
        You are an elite copywriter.
        
        TASK: Write a {channel} message.
        GOAL: {strategy.goal}
        HOOK: {strategy.hook}
        KEY POINTS: {', '.join(strategy.key_points)}
        CTA: {strategy.cta}
        
        TARGET PERSONA:
        Name: {prospect.name}
        Role: {prospect.role}
        Style Matches: {psych.communication_style}
        
        HISTORY_CONTEXT:
        {history_context}
        
        STYLE RULES (MIMIC THIS):
        {chr(10).join(psych.style_rules)}
        
        {kb_context}
        
        PLATFORM RULES:
        {rules}
        
        {comments}
        
        IMPORTANT: Use HISTORY_CONTEXT to understand the conversation flow, but do NOT be overly constrained by it. 
        Your primary guide is the GOAL and STRATEGY. 
        If the history is irrelevant to the current goal, pivot gracefully.
        
        Output ONLY the message content.
        """
        
        try:
            response = llm_creative.invoke(prompt)
            new_drafts[channel] = response.content
            logs.append(f"✍️ SCRIBE: Drafted {channel}.")
        except Exception as e:
            logger.error(f"Scribe failed for {channel}: {e}")
            new_drafts[channel] = f"[Error: Failed to generate draft for {channel} due to LLM error: {str(e)}]"
            logs.append(f"✍️ SCRIBE: Failed to draft {channel}.")

    return {
        "drafts": new_drafts, 
        "revision_count": state.get("revision_count", 0) + 1,
        "final_output": new_drafts, # Update final output
        "latest_critique": None, # Reset critique so Supervisor knows to send to Critic
        "logs": logs
    }

# --- Node 5: THE CRITIC (Dictionary Aware) ---
def critic_node(state: AgentState) -> AgentState:
    """
    Evaluates the drafts.
    """
    logger.info("⚖️ CRITIC: Judging work...")
    strategy = state["strategy"]
    drafts = state["drafts"]
    psych: PsychProfile = state.get("psych")
    logs = state.get("logs", [])
    
    # Auto-pass general response
    if "general_response" in strategy.target_channels:
        logs.append("⚖️ CRITIC: General response auto-approved.")
        return {
            "latest_critique": CritiqueResult(score=10, feedback="Pass", passed=True),
            "logs": logs
        }

    # Critiques the FIRST drafted channel for now to keep logic simple
    # Ideally should critique all, but we limit complexity.
    target = strategy.target_channels[0]
    latest_draft = drafts.get(target, "")
    
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
                    CHANNEL: {target}
                    INTENDED TONE: {psych.communication_style}
                    DRAFT:
                    {latest_draft}
                    
                    Evaluate:
                    1. Fit for channel?
                    2. Matches prospect's likely style?
                    3. Not spammy?
                    """
                }
            ]
        )
        logs.append(f"⚖️ CRITIC: Score {critique.score}/10 on {target}. Passed: {critique.passed}")
        
        # If passed, save to KB as "good example" (optimistic)
        if critique.passed:
            kb.save_outreach(state["prospect"], strategy, latest_draft)
            
        return {"latest_critique": critique, "logs": logs}
        
    except Exception as e:
        logger.error(f"Critic failed: {e}")
        return {
            "latest_critique": CritiqueResult(score=10, feedback="Critic offline", passed=True),
            "logs": logs
        }