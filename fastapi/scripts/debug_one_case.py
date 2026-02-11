import time
import json
import httpx

API_URL = "http://127.0.0.1:8000/ml/agent/chat"
MODEL = "qwen2.5:7b"

CASE = {
    "name": "Fintech VP (formal)",
    "message": "PROFILE: Name: Aisha Khan. Role: VP of Product. Company: StellarPay (fintech). About: Leads payments platform, writes about risk controls and trust. Recent: Reliability > speed when money moves. Interests: compliance automation, platform reliability. Tone: formal, precise. Generate outreach for all channels."
}


def parse_sse_lines(buffer: str):
    lines = buffer.split("\n\n")
    remainder = lines.pop() if lines else ""
    return lines, remainder


async def main():
    payload = {
        "model": MODEL,
        "message": CASE["message"],
        "conversation_history": [],
        "max_iterations": 10
    }

    final_text = ""
    async with httpx.AsyncClient() as client:
        async with client.stream("POST", API_URL, json=payload, timeout=180.0) as resp:
            resp.raise_for_status()
            buffer = ""
            async for chunk in resp.aiter_text():
                buffer += chunk
                lines, buffer = parse_sse_lines(buffer)
                for line in lines:
                    if not line.startswith("data: "):
                        continue
                    try:
                        data = json.loads(line[6:])
                    except Exception:
                        continue
                    if data.get("type") == "response":
                        final_text = data.get("content", "")
                    if data.get("type") == "done":
                        print(final_text)
                        return


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
