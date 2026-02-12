from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from pathlib import Path
import base64
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from ml.application.agent.schemas import AgentRequest, AgentResponse, AgentStreamChunk
from ml.application.agent.streaming import stream_agent_response
from ml.application.agent.graph import run_agent
from ml.infrastructure.db.sqlite import get_thread_history, add_message, create_thread, get_all_threads

SARGE_AVAILABLE = True
SARGE_IMPORT_ERROR = None
try:
    from ml.application.sarge.graph import run_sarge, stream_sarge
    from ml.application.sarge.nodes import get_tts
except Exception as e:
    # Allow main app to start without optional SARGE/TTS dependencies
    SARGE_AVAILABLE = False
    SARGE_IMPORT_ERROR = str(e)
import uuid
import os
import asyncio

router = APIRouter(prefix="/ml", tags=["ML"])
VOICE_PROFILES_DIR = Path("assets/voice_profiles")
VOICE_REGISTRY_PATH = VOICE_PROFILES_DIR / "profiles.json"


def _safe_email_key(email: str) -> str:
    return email.strip().lower().replace("@", "_at_").replace(".", "_")


def _resolve_voice_profile_path(email: str) -> Path | None:
    safe_email = _safe_email_key(email)
    candidates = sorted(VOICE_PROFILES_DIR.glob(f"{safe_email}.*"))
    return candidates[0] if candidates else None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_voice_registry() -> List[Dict[str, Any]]:
    if not VOICE_REGISTRY_PATH.exists():
        return []
    try:
        with open(VOICE_REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_voice_registry(records: List[Dict[str, Any]]) -> None:
    VOICE_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    with open(VOICE_REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)


def _get_default_voice_profile_for_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None
    records = _load_voice_registry()
    for r in records:
        if r.get("email") == email and r.get("is_default"):
            return r
    # fallback to most recent
    candidates = [r for r in records if r.get("email") == email]
    if not candidates:
        return None
    return sorted(candidates, key=lambda x: x.get("updated_at", ""), reverse=True)[0]


def _sanitize_default_voice_id(voice_id: Optional[str]) -> Optional[str]:
    if not voice_id:
        return None
    return voice_id.strip()


class VoiceProfileUploadRequest(BaseModel):
    email: str
    audio_base64: str
    extension: str = ".wav"
    profile_name: Optional[str] = None
    personality: Optional[str] = None
    use_as_default: bool = True


class SargeVoiceRequest(BaseModel):
    text: str
    email: Optional[str] = None
    voice_mode: Optional[str] = "auto"  # auto | default | custom
    default_voice_id: Optional[str] = None
    voice_profile_id: Optional[str] = None
    personality: Optional[str] = None


class LinkScrapeRequest(BaseModel):
    links: List[str]
    context: str = "profile"  # profile | contact


def _extract_urls(text: str) -> List[str]:
    import re
    return re.findall(r"https?://[^\s]+", text or "")


def _normalize_url(url: str) -> str:
    return (url or "").strip()


def _merge_profile_from_content(result: Dict[str, Any], content: Any, source_url: str):
    if not isinstance(content, dict):
        return

    # LinkedIn style payload
    if "profile" in content and isinstance(content["profile"], dict):
        p = content["profile"]
        name = p.get("Name") or p.get("name")
        headline = p.get("Headline") or p.get("headline")
        about = p.get("About") or p.get("bio")
        if name:
            result["name"] = result.get("name") or name
        if headline:
            result["role"] = result.get("role") or headline
        if about:
            result["bio"] = result.get("bio") or about
        profile_url = p.get("ProfileURL") or p.get("profile_url")
        if profile_url and "linkedin.com" in profile_url:
            result.setdefault("socials", {}).setdefault("linkedin", profile_url)

    # GitHub style payload
    if "profile" in content and isinstance(content["profile"], dict):
        gp = content["profile"]
        if gp.get("name"):
            result["name"] = result.get("name") or gp["name"]
        if gp.get("company"):
            result["company"] = result.get("company") or gp["company"]
        if gp.get("bio"):
            result["bio"] = result.get("bio") or gp["bio"]
        if gp.get("blog"):
            result["website"] = result.get("website") or gp["blog"]
        if gp.get("twitter_username"):
            result.setdefault("socials", {}).setdefault("twitter", f"https://twitter.com/{gp['twitter_username']}")
        if "github.com" in source_url:
            result.setdefault("socials", {}).setdefault("github", source_url)

    # Generic article style payload
    title = content.get("title") or content.get("Title")
    subtitle = content.get("subtitle") or content.get("Subtitle")
    summary = subtitle or title
    if summary and not result.get("bio"):
        result["bio"] = summary[:500]


def _merge_contact_from_content(result: Dict[str, Any], content: Any, source_url: str):
    if not isinstance(content, dict):
        return

    if "profile" in content and isinstance(content["profile"], dict):
        p = content["profile"]
        name = p.get("Name") or p.get("name")
        headline = p.get("Headline") or p.get("headline")
        about = p.get("About") or p.get("bio")
        company = p.get("company")
        if name:
            result["name"] = result.get("name") or name
        if headline:
            result["role"] = result.get("role") or headline
        if company:
            result["company"] = result.get("company") or company
        if about and not result.get("notes"):
            result["notes"] = about[:600]

        if "linkedin.com" in source_url:
            result["linkedinUrl"] = result.get("linkedinUrl") or source_url
        if "github.com" in source_url and not result.get("notes"):
            result["notes"] = f"GitHub profile detected: {source_url}"

_SIMPLE_QUERIES = {
    "hi",
    "hello",
    "hey",
    "hey there",
    "hiya",
    "how are you",
    "how are you doing",
    "how r u",
    "how can you help me",
    "what can you do",
    "what do you do",
    "who are you",
    "help",
    "help me",
}


def _normalize_simple_query(text: str) -> str:
    import re
    normalized = text.strip().lower()
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _get_simple_response(message: str) -> str | None:
    normalized = _normalize_simple_query(message)
    if normalized in _SIMPLE_QUERIES:
        return (
            "Hi! I can help with outreach drafts, research summaries, and general questions. "
            "Tell me what you want to do."
        )
    return None


@router.get("/models")
async def get_ollama_models():
    """
    Get the list of available Ollama models.
    """
    try:
        import subprocess
        import json
        
        # Use ollama CLI to list models
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Parse the output
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        models = []
        
        for line in lines:
            if line.strip():
                # Extract model name (first column)
                model_name = line.split()[0]
                models.append(model_name)
        
        return {
            "count": len(models),
            "models": models
        }
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Ollama service: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing models: {str(e)}"
        )


@router.post("/scrape/links")
async def scrape_links(request: LinkScrapeRequest):
    """
    Scrape one or more URLs using CrawlerDispatcher and return extracted field hints
    for profile/contact forms.
    """
    try:
        from ml.application.crawlers.dispatcher import CrawlerDispatcher

        links = [_normalize_url(l) for l in request.links if _normalize_url(l).startswith("http")]
        if not links:
            return {"extracted": {}, "results": []}

        dispatcher = (
            CrawlerDispatcher.build()
            .register_linkedin()
            .register_medium()
            .register_github()
        )

        async def _crawl(url: str):
            crawler = dispatcher.get_crawler(url)
            try:
                crawl_input = url
                # GithubCrawler expects username rather than full URL.
                if "github.com" in url and crawler.__class__.__name__ in {"GithubProfileCrawler", "GithubCrawler"}:
                    from urllib.parse import urlparse
                    parts = [p for p in urlparse(url).path.split("/") if p]
                    if parts:
                        crawl_input = parts[0]
                if hasattr(crawler, "aextract"):
                    content = await crawler.aextract(crawl_input)
                else:
                    content = await asyncio.to_thread(crawler.extract, crawl_input)
                return {"url": url, "ok": True, "content": content}
            except Exception as e:
                return {"url": url, "ok": False, "error": str(e), "content": None}

        results = await asyncio.gather(*[_crawl(u) for u in links], return_exceptions=False)

        extracted: Dict[str, Any] = {"socials": {}}
        for item in results:
            if not item.get("ok"):
                continue
            content = item.get("content")
            source_url = item.get("url", "")
            if request.context == "contact":
                _merge_contact_from_content(extracted, content, source_url)
            else:
                _merge_profile_from_content(extracted, content, source_url)

            # Always keep raw source links
            if "linkedin.com" in source_url:
                extracted.setdefault("socials", {}).setdefault("linkedin", source_url)
            elif "github.com" in source_url:
                extracted.setdefault("socials", {}).setdefault("github", source_url)
            elif "twitter.com" in source_url or "x.com" in source_url:
                extracted.setdefault("socials", {}).setdefault("twitter", source_url)
            else:
                extracted["website"] = extracted.get("website") or source_url

        return {"extracted": extracted, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Link scraping failed: {str(e)}")

# class ChatRequest(BaseModel):
#     message: str
#     model: str = "gemma3:4b"

# @router.post("/chat")
# async def chat_stream(request: ChatRequest):
#     """
#     Stream chat responses from Ollama model.
#     Returns Server-Sent Events stream for live updates.
#     """
#     try:
#         def generate():
#             stream = ollama.chat(
#                 model=request.model,
#                 messages=[{"role": "user", "content": request.message}],
#                 stream=True
#             )
            
#             for chunk in stream:
#                 if chunk['message']['content']:
#                     # Send each chunk as JSON
#                     yield f"data: {json.dumps({'content': chunk['message']['content']})}\n\n"
            
#             # Send end signal
#             yield f"data: {json.dumps({'done': True})}\n\n"
        
#         return StreamingResponse(
#             generate(),
#             media_type="text/event-stream",
#             headers={
#                 "Cache-Control": "no-cache",
#                 "Connection": "keep-alive",
#             }
#         )
#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=f"Chat failed: {str(e)}"
#         )


@router.post("/agent/chat", response_class=StreamingResponse)
async def agent_chat_stream(request: AgentRequest):
    """
    Stream agent responses with tool calling capabilities.
    
    The agent can use tools like web search and article scraping to answer questions.
    Returns Server-Sent Events stream for live updates including:
    - Agent thoughts and reasoning
    - Tool calls and results
    - Final responses
    
    Example:
        POST /ml/agent/chat
        {
            "message": "Search for the latest AI news and summarize the top article",
            "model": "gemma2:2b",
            "max_iterations": 10
        }
    """
    try:
        simple_response = _get_simple_response(request.message)
        if simple_response:
            thread_id = request.thread_id or str(uuid.uuid4())

            add_message(
                thread_id=thread_id,
                role="user",
                content=request.message
            )
            add_message(
                thread_id=thread_id,
                role="assistant",
                content=simple_response
            )

            async def stream_simple():
                yield f"data: {json.dumps({'thread_id': thread_id})}\n\n"
                response_chunk = AgentStreamChunk(
                    type="response",
                    content=simple_response
                )
                yield f"data: {response_chunk.model_dump_json()}\n\n"
                done_chunk = AgentStreamChunk(
                    type="done",
                    content=simple_response,
                    metadata={"iterations": 0, "simple": True}
                )
                yield f"data: {done_chunk.model_dump_json()}\n\n"

            return StreamingResponse(
                stream_simple(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
            )

        # 1. Handle Thread ID
        thread_id = request.thread_id or str(uuid.uuid4())
        
        # 2. Get History if thread exists
        history_dicts = get_thread_history(thread_id)
        
        # If history exists, it overrides request.conversation_history
        # But for now, let's merge or use request history if DB is empty
        # A simple strategy: usage of DB history is preferred if thread_id was provided
        if request.thread_id and history_dicts:
            pass # We will use history_dicts below
        else:
            # If no existing thread, use request history
            history_dicts = [msg.model_dump() for msg in request.conversation_history]
            
        # 3. Save User Message
        add_message(
            thread_id=thread_id,
            role="user",
            content=request.message
        )

        # 4. Stream and Capture Response
        async def stream_and_persist():
            full_response = ""
            tool_calls = []
            
            # Send initial thread_id event if needed by frontend (optional)
            yield f"data: {json.dumps({'thread_id': thread_id})}\n\n"
            
            async for chunk in stream_agent_response(
                message=request.message,
                model=request.model,
                conversation_history=history_dicts,
                max_iterations=request.max_iterations
            ):
                # Parse chunk to accumulate content
                if chunk.startswith("data: "):
                    try:
                        data = json.loads(chunk[6:])
                        if "content" in data:
                            full_response += data["content"]
                        # We might parse tool calls here if needed, but simplified for now
                        # Ideally, stream_agent_response should yield structured events we can capture
                    except:
                        pass
                yield chunk
            
            # 5. Save Assistant Message on completion
            # Note: capturing tool calls from raw stream text is hard. 
            # Ideally stream_agent_response returns the final state or we refactor.
            # For now, we save the text response.
            if full_response:
                add_message(
                    thread_id=thread_id,
                    role="assistant",
                    content=full_response
                )

        return StreamingResponse(
            stream_and_persist(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent chat failed: {str(e)}"
        )


@router.post("/agent/chat-sync", response_model=AgentResponse)
async def agent_chat_sync(request: AgentRequest):
    """
    Synchronous agent chat without streaming.
    
    Waits for the agent to complete all reasoning and tool calls,
    then returns the final response.
    
    Useful for:
    - Simple integrations that don't need streaming
    - Batch processing
    - Cases where you want the complete response at once
    
    Example:
        POST /ml/agent/chat-sync
        {
            "message": "What is the capital of France?",
            "model": "gemma2:2b"
        }
    """
    try:
        simple_response = _get_simple_response(request.message)
        if simple_response:
            return AgentResponse(
                response=simple_response,
                tool_calls=[],
                iterations=0,
                model=request.model
            )

        # Extract target_url and user_instruction
        import re
        url_pattern = r'https?://[^\s]+'
        urls = re.findall(url_pattern, request.message)
        if urls:
            target_url = urls[0]
            user_instruction = request.message.replace(target_url, "").strip() or "Analyze this"
        else:
            target_url = None
            user_instruction = request.message

        result = await run_agent(
            target_url=target_url,
            user_instruction=user_instruction
        )
        
        # Extract tool calls from messages
        tool_calls = []
        for msg in result.get("messages", []):
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append({
                        "name": tc.get("name"),
                        "input": tc.get("args")
                    })
        
        return AgentResponse(
            response=result["response"],
            tool_calls=tool_calls,
            iterations=result["iterations"],
            model=request.model
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent chat failed: {str(e)}"
        )


@router.get("/agent/threads")
async def get_threads():
    """
    Get all conversation threads.
    """
    try:
        threads = get_all_threads()
        return [
            {
                "id": t.id,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
                "metadata": {"title": t.title or "New Conversation"}
            }
            for t in threads
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch threads: {str(e)}"
        )


@router.get("/agent/threads/{thread_id}")
async def get_thread_history_endpoint(thread_id: str):
    """
    Get conversation history for a specific thread.
    """
    try:
        history = get_thread_history(thread_id)
        if not history:
            return []
            
        # Transform for frontend if necessary, or return as is
        # The frontend expects: role, content, tool_calls
        return history
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch thread history: {str(e)}"
        )

@router.post("/agent/sarge/chat", response_class=StreamingResponse)
async def sarge_chat_stream(request: AgentRequest):
    """
    Stream SARGE agent responses with granular events (microprocesses).
    
    Returns Server-Sent Events stream:
    - node_start: When a step begins (Router, Profiler, etc)
    - thought: Internal reasoning logs
    - result: Final generated content
    - token: Real-time LLM token streaming
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    session_id = request.thread_id or str(uuid.uuid4())
    
    async def event_generator():
        try:
            # Initial event to confirm connection
            yield f"data: {json.dumps({'type': 'status', 'content': 'SARGE Connected', 'session_id': session_id})}\n\n"
            
            async for chunk in stream_sarge(request.message, session_id=session_id):
                yield f"data: {chunk}\n\n"
                
            # Done signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            error_chunk = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/agent/sarge/chat-sync", response_model=AgentResponse)
async def sarge_chat_sync(request: AgentRequest):
    """
    Synchronous SARGE agent chat.
    Uses the new SARGE graph with persistence and upgrades.
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    try:
        session_id = request.thread_id or str(uuid.uuid4())
        
        result = await run_sarge(request.message, session_id=session_id)
        
        # Format response to match AgentResponse schema
        final_content = result.get("generated_content", {})
        
        # Flatten content for client if needed, or keep dict
        # The schema expects dict[str, str] for response, so we pass it directly
        
        return AgentResponse(
            response=final_content,
            tool_calls=[], # SARGE handles tools internally, doesn't expose raw calls yet
            iterations=result.get("generation_attempts", 1),
            model=request.model
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SARGE chat failed: {str(e)}"
        )
@router.get("/agent/sarge/voices")
async def get_sarge_voices(email: Optional[str] = None):
    """List built-in default voices and saved cloned voice profiles."""
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")
    try:
        tts_engine = await asyncio.to_thread(get_tts)
        default_voices = await asyncio.to_thread(tts_engine.get_default_speakers)
        default_items = [{"id": v, "name": v, "source": "default"} for v in default_voices]

        custom_records = _load_voice_registry()
        if email:
            custom_records = [r for r in custom_records if r.get("email") == email]
        custom_items = [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "personality": r.get("personality", ""),
                "email": r.get("email"),
                "source": "custom",
                "is_default": bool(r.get("is_default")),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
            }
            for r in custom_records
        ]
        return {"default_voices": default_items, "custom_voices": custom_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {str(e)}")


@router.patch("/agent/sarge/voice-profiles/{profile_id}/default")
async def set_default_voice_profile(profile_id: str):
    records = _load_voice_registry()
    target = next((r for r in records if r.get("id") == profile_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    email = target.get("email")
    for r in records:
        if r.get("email") == email:
            r["is_default"] = r.get("id") == profile_id
            r["updated_at"] = _utc_now_iso()
    _save_voice_registry(records)
    return {"message": "Default voice updated", "profile_id": profile_id}


@router.delete("/agent/sarge/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str):
    records = _load_voice_registry()
    target = next((r for r in records if r.get("id") == profile_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    remaining = [r for r in records if r.get("id") != profile_id]
    file_path = target.get("file_path")
    if file_path:
        p = Path(file_path)
        p.unlink(missing_ok=True)
        Path(str(p) + ".se.pt").unlink(missing_ok=True)

    if target.get("is_default"):
        email = target.get("email")
        same_email = [r for r in remaining if r.get("email") == email]
        if same_email:
            newest = sorted(same_email, key=lambda x: x.get("updated_at", ""), reverse=True)[0]
            newest["is_default"] = True
            newest["updated_at"] = _utc_now_iso()

    _save_voice_registry(remaining)
    return {"message": "Voice profile deleted", "profile_id": profile_id}


@router.post("/agent/sarge/voice")
async def sarge_voice(request: SargeVoiceRequest):
    """
    Generate audio for a given text with either default model voices or saved custom clones.
    """
    if not SARGE_AVAILABLE:
        raise HTTPException(status_code=503, detail=f"SARGE unavailable: {SARGE_IMPORT_ERROR}")

    text = request.text
    email = request.email
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        tts_engine = await asyncio.to_thread(get_tts)
        used_cloned_voice = False
        voice_mode = (request.voice_mode or "auto").lower()
        selected_default_voice = _sanitize_default_voice_id(request.default_voice_id)

        profile_record = None
        records = _load_voice_registry()
        if request.voice_profile_id:
            profile_record = next((r for r in records if r.get("id") == request.voice_profile_id), None)
        elif email:
            profile_record = _get_default_voice_profile_for_email(email)

        if voice_mode == "default":
            await asyncio.to_thread(tts_engine.clear_speaker)
        elif voice_mode == "custom":
            if not profile_record:
                raise HTTPException(status_code=404, detail="Custom voice profile not found")
            profile_path = Path(profile_record.get("file_path", ""))
            if not profile_path.exists():
                raise HTTPException(status_code=404, detail="Custom voice sample file not found")
            await asyncio.to_thread(tts_engine.ensure_speaker, str(profile_path))
            used_cloned_voice = True
        else:  # auto
            if profile_record:
                profile_path = Path(profile_record.get("file_path", ""))
                if profile_path.exists():
                    await asyncio.to_thread(tts_engine.ensure_speaker, str(profile_path))
                    used_cloned_voice = True
            else:
                await asyncio.to_thread(tts_engine.clear_speaker)

        os.makedirs("static/audio", exist_ok=True)

        filename = f"manual_{uuid.uuid4().hex[:8]}.wav"
        file_path = os.path.join("static/audio", filename)

        await asyncio.to_thread(
            tts_engine.speak,
            text=text[:1000],
            output_path=file_path,
            base_speaker=selected_default_voice
        )

        return {
            "audio_url": f"/static/audio/{filename}",
            "used_cloned_voice": used_cloned_voice,
            "voice_mode": voice_mode,
            "default_voice_id": selected_default_voice,
            "voice_profile_id": profile_record.get("id") if profile_record else None,
            "personality": profile_record.get("personality") if profile_record else request.personality,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/sarge/voice-profile")
async def upload_sarge_voice_profile(request: VoiceProfileUploadRequest):
    """
    Save a custom cloned voice profile (name + personality) for later selection.
    """
    email = request.email
    if not email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if not request.audio_base64:
        raise HTTPException(status_code=400, detail="Audio payload is required")

    try:
        content = base64.b64decode(request.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio payload")

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded voice file is empty")

    ext = (request.extension or ".wav").lower()
    if ext != ".wav":
        raise HTTPException(
            status_code=400,
            detail="Only WAV voice samples are supported for reliable cloning. Please upload a .wav recording."
        )

    try:
        VOICE_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
        profile_id = uuid.uuid4().hex[:10]
        profile_path = VOICE_PROFILES_DIR / f"{profile_id}{ext}"

        with open(profile_path, "wb") as f:
            f.write(content)

        tts_engine = await asyncio.to_thread(get_tts)
        await asyncio.to_thread(tts_engine.ensure_speaker, str(profile_path))

        records = _load_voice_registry()
        if request.use_as_default:
            for r in records:
                if r.get("email") == email:
                    r["is_default"] = False
                    r["updated_at"] = _utc_now_iso()

        rec = {
            "id": profile_id,
            "email": email,
            "name": (request.profile_name or f"My Voice {len(records) + 1}").strip(),
            "personality": (request.personality or "professional").strip(),
            "file_path": str(profile_path),
            "is_default": bool(request.use_as_default),
            "created_at": _utc_now_iso(),
            "updated_at": _utc_now_iso(),
        }
        records.append(rec)
        _save_voice_registry(records)

        return {
            "message": "Voice profile uploaded for TTS cloning",
            "profile": {
                "id": rec["id"],
                "name": rec["name"],
                "personality": rec["personality"],
                "email": rec["email"],
                "is_default": rec["is_default"],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process voice profile: {str(e)}")
