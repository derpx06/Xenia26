"""
Test script for SARGE streaming
Verifies that stream_sarge yields expected events
"""
import asyncio
import json
import time
from ml.application.sarge.graph import stream_sarge

async def test_streaming():
    print("🧪 SARGE Streaming Verification")
    print("="*80)
    
    # Test Input
    user_input = "Generate a cold email for Alex Rivera, CTO at TechCorp"
    print(f"INPUT: {user_input}\n")
    
    start = time.time()
    event_count = 0
    
    try:
        async for chunk in stream_sarge(user_input):
            event_count += 1
            data = json.loads(chunk)
            event_type = data.get("type")
            
            # Print simplified event info
            if event_type == "node_start":
                print(f"🔵 NODE START: {data.get('node')}")
            elif event_type == "thought":
                node = data.get("node")
                content = data.get("content")
                # Truncate content for display
                print(f"🧠 THOUGHT [{node}]: {str(content)[:100]}...")
            elif event_type == "result":
                print(f"✅ RESULT: {str(data.get('content'))[:100]}...")
            elif event_type == "token":
                print(f"🔤 TOKEN: {data.get('content')}", end="", flush=True)
            else:
                print(f"UNKNOWN EVENT: {data}")
                
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        
    elapsed = time.time() - start
    print(f"\n\n{'='*80}")
    print(f"Total Events: {event_count}")
    print(f"Time: {elapsed:.2f}s")
    
    if event_count > 5:
        print("✅ Streaming Validation Passed")
    else:
        print("❌ Streaming Validation Failed (Too few events)")

if __name__ == "__main__":
    asyncio.run(test_streaming())
