"""
SARGE Elite Upgrade Verification Script
Verifies:
1. Memory Persistence
2. Speed (<60s) [To be added]
3. Style Transfer [To be added]
4. Crawler Caching [To be added]
"""
import asyncio
import uuid
import time
from loguru import logger
from ml.application.sarge.graph import run_sarge
from ml.application.sarge.memory import SargeMemory

async def test_memory_persistence():
    print("\n🧪 TESTING MEMORY PERSISTENCE", flush=True)
    print("="*40, flush=True)
    
    session_id = str(uuid.uuid4())
    print(f"Session ID: {session_id}", flush=True)
    
    # turn 1: State name
    print("\n[Turn 1] User: My name is Maximus.", flush=True)
    await run_sarge("My name is Maximus.", session_id=session_id)
    
    # turn 2: Recall name
    print("\n[Turn 2] User: What is my name?")
    result = await run_sarge("What is my name?", session_id=session_id)
    
    # Check response logic
    response = ""
    gen_content = result.get("generated_content", {})
    if "direct_response" in gen_content:
        response = gen_content["direct_response"]
    elif "chat_response" in gen_content:
        response = gen_content["chat_response"]
        
    print(f"Assistant: {response}")
    
    if "Maximus" in response:
        print("✅ PASS: Memory recalled name correctly.")
    else:
        print("❌ FAIL: Memory failed to recall name.")


async def test_speed_and_partial_retry():
    print("\n⚡ TESTING SPEED & PARTIAL RETRY")
    print("="*40)
    
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    # 1. Full Generation Test
    print("\n[Step 1] Full Generation (Email + LinkedIn + WhatsApp)")
    # Using a known entity to trigger full flow
    input_text = "Draft outreach for CTO of Stripe about our AI latency solution."
    
    result = await run_sarge(input_text, session_id=session_id)
    
    duration = time.time() - start_time
    print(f"⏱️ Total Time: {duration:.2f}s")
    
    if duration < 60:
        print(f"✅ PASS: Speed < 60s ({duration:.2f}s)")
    else:
        print(f"⚠️ WARN: Speed > 60s ({duration:.2f}s)")
        
    # Check if all channels generated
    content = result.get("generated_content", {})
    channels = [k for k in ["email", "linkedin", "whatsapp"] if content.get(k)]
    print(f"Channels Generated: {channels}")
    
    if len(channels) == 3:
        print("✅ PASS: All channels generated.")
    else:
        print(f"❌ FAIL: Missing channels. Got: {channels}")

async def test_news_jacking_and_style():
    print("\n📰 TESTING NEWS JACKING & STYLE TRANSFER")
    print("="*40)
    
    session_id = str(uuid.uuid4())
    
    # 1. News Jacking Test
    print("\n[Step 1] News Jacking (NVIDIA)")
    input_text = "Draft an email to Jensen Huang at NVIDIA about AI scaling."
    result = await run_sarge(input_text, session_id=session_id)
    
    hook = result.get("strategy_brief", {}).get("hook", "")
    print(f"Generated Hook: {hook}")
    
    # Check if news context was found (this depends on DDG results, but usually NVIDIA has news)
    if result.get("news_context"):
        print("✅ PASS: News context captured.")
    else:
        print("⚠️ WARN: News context empty (might be DDG rate limit or no news).")

    # 2. Style Transfer Test
    print("\n[Step 2] Style Transfer (Reference URL)")
    # Using a Paul Graham essay URL as style reference
    style_url = "https://paulgraham.com/growth.html"
    input_text = f"Draft a LinkedIn DM to a startup founder. Use the style from this URL: {style_url}"
    
    result = await run_sarge(input_text, session_id=session_id)
    
    writing_style = result.get("writing_style")
    if writing_style and writing_style.get("rules"):
        print(f"✅ PASS: Style inferred from {style_url}")
        print(f"Rules: {writing_style['rules'][:2]}")
    else:
        print("❌ FAIL: Style inference failed.")

async def main():
    await test_memory_persistence()
    await test_speed_and_partial_retry()
    await test_news_jacking_and_style()

if __name__ == "__main__":
    asyncio.run(main())
