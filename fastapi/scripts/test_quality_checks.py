import time
import json
import re
import httpx

API_URL = "http://127.0.0.1:8000/ml/agent/chat"
MODEL = "qwen2.5:7b"
MAX_SECONDS = 180.0

CASES = [
    {
        "name": "Fintech VP (formal)",
        "profile": {
            "name": "Aisha Khan",
            "role": "VP of Product",
            "company": "StellarPay",
            "interests": ["compliance automation", "platform reliability"],
            "recent": ["Reliability > speed when money moves"],
        },
        "message": "PROFILE: Name: Aisha Khan. Role: VP of Product. Company: StellarPay (fintech). About: Leads payments platform, writes about risk controls and trust. Recent: Reliability > speed when money moves. Interests: compliance automation, platform reliability. Tone: formal, precise. Generate outreach for all channels."
    },
    {
        "name": "Casual founder (emoji)",
        "profile": {
            "name": "Marco Lee",
            "role": "Founder",
            "company": "Looply",
            "interests": ["productivity", "indie hacking"],
            "recent": ["shipped v2 in 6 days"],
        },
        "message": "PROFILE: Name: Marco Lee. Role: Founder. Company: Looply. Bio: building tiny tools for busy teams. Recent: shipped v2 in 6 days. Interests: productivity, indie hacking. Tone: casual, emoji. Need email + whatsapp + linkedin dm + instagram dm."
    },
    {
        "name": "Healthcare director (professional)",
        "profile": {
            "name": "Dr. Priya Nair",
            "role": "Director of Clinical Ops",
            "company": "Northbridge Health",
            "interests": ["ops analytics", "scheduling"],
            "recent": ["reducing discharge delays by 18%"],
        },
        "message": "PROFILE: Name: Dr. Priya Nair. Role: Director of Clinical Ops. Company: Northbridge Health. About: Focused on patient throughput and staffing efficiency. Recent: reducing discharge delays by 18%. Interests: ops analytics, scheduling. Tone: professional, measured. Generate cold email + linkedin dm + sms."
    },
]


def parse_sse_lines(buffer: str):
    lines = buffer.split("\n\n")
    remainder = lines.pop() if lines else ""
    return lines, remainder


def extract_channels(text: str):
    channels = {}
    pattern = r"##\\s*(.+?)\\n(.*?)(?=(\\n##\\s)|\\Z)"
    for match in re.finditer(pattern, text, flags=re.DOTALL):
        title = match.group(1).strip().lower().replace(" ", "_")
        body = match.group(2).strip()
        channels[title] = body
    return channels


def personalization_score(text: str, profile: dict) -> int:
    hits = 0
    if profile["name"].lower() in text.lower():
        hits += 1
    if profile["role"].lower() in text.lower():
        hits += 1
    if profile["company"].lower() in text.lower():
        hits += 1
    for item in profile["interests"] + profile["recent"]:
        if item.lower() in text.lower():
            hits += 1
            break
    return hits


def hook_strength(email_text: str) -> bool:
    lines = [l.strip() for l in email_text.splitlines() if l.strip()]
    if not lines:
        return False
    first = lines[0]
    # crude hook check: short + specific indicator
    return len(first.split()) <= 10 and any(k in first.lower() for k in ["reliability", "growth", "product", "ops", "compliance", "v2", "throughput"])


async def run_case(client: httpx.AsyncClient, case):
    payload = {
        "model": MODEL,
        "message": case["message"],
        "conversation_history": [],
        "max_iterations": 10
    }

    t0 = time.perf_counter()
    final_text = ""

    async with client.stream("POST", API_URL, json=payload, timeout=MAX_SECONDS) as resp:
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
                    t_done = time.perf_counter()
                    return {
                        "case": case["name"],
                        "ms": round((t_done - t0) * 1000, 1),
                        "text": final_text
                    }

    return {"case": case["name"], "ms": None, "text": final_text}


async def main():
    results = []
    async with httpx.AsyncClient() as client:
        for case in CASES:
            results.append(await run_case(client, case))

    for r, case in zip(results, CASES):
        channels = extract_channels(r["text"])
        pscore = personalization_score(r["text"], case["profile"])
        email_text = channels.get("email", "")
        hook_ok = hook_strength(email_text) if email_text else False
        print(f"{r['case']}: time_ms={r['ms']} personalization_hits={pscore} hook_ok={hook_ok}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
