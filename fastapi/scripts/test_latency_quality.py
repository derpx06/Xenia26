import time
import json
import httpx

API_URL = "http://127.0.0.1:8000/ml/agent/chat"
MODEL = "qwen2.5:3b-instruct"
MAX_SECONDS = 180.0

CASES = [
    {
        "name": "Fintech VP (formal)",
        "message": "PROFILE: Name: Aisha Khan. Role: VP of Product. Company: StellarPay (fintech). About: Leads payments platform, writes about risk controls and trust. Recent post: 'Reliability > speed when money moves.' Interests: compliance automation, platform reliability. Tone: formal, precise. Generate outreach for all channels."
    },
    {
        "name": "Casual founder (emoji)",
        "message": "PROFILE: Name: Marco Lee. Role: Founder. Company: Looply. Bio: 'building tiny tools for busy teams ??. love short updates, no fluff.' Recent: 'shipped v2 in 6 days!!'. Interests: productivity, indie hacking. Tone: casual, emoji. Need email + whatsapp + linkedin dm + instagram dm."
    },
    {
        "name": "Healthcare director (professional)",
        "message": "PROFILE: Name: Dr. Priya Nair. Role: Director of Clinical Ops. Company: Northbridge Health. About: Focused on patient throughput and staffing efficiency. Recent: 'reducing discharge delays by 18%'. Interests: ops analytics, scheduling, patient outcomes. Tone: professional, measured. Generate cold email + linkedin dm + sms."
    },
    {
        "name": "Growth marketer (punchy)",
        "message": "PROFILE: Name: Jake Torres. Role: Growth Marketing Lead. Company: NovaFit. Bio: 'I like punchy copy and data-backed hooks.' Recent: 'CAC down 22% with new landing tests'. Interests: A/B testing, CRO, copywriting. Tone: punchy, direct. Generate email + linkedin dm + whatsapp + instagram dm."
    },
    {
        "name": "Engineering manager (concise)",
        "message": "PROFILE: Name: Linh Tran. Role: Engineering Manager. Company: BlueOrbit. About: 'Keep it concise. Bullet points > paragraphs.' Recent: 'migrated legacy services to async'. Interests: backend performance, reliability. Tone: concise, technical. Generate email + linkedin dm + sms."
    }
]


def parse_sse_lines(buffer: str):
    lines = buffer.split("\n\n")
    remainder = lines.pop() if lines else ""
    return lines, remainder


async def run_case(client: httpx.AsyncClient, case):
    payload = {
        "model": MODEL,
        "message": case["message"],
        "conversation_history": [],
        "max_iterations": 10
    }

    t0 = time.perf_counter()
    t_first_chunk = None
    t_first_milestone = None
    t_done = None

    async with client.stream("POST", API_URL, json=payload, timeout=MAX_SECONDS) as resp:
        resp.raise_for_status()
        buffer = ""
        async for chunk in resp.aiter_text():
            if t_first_chunk is None:
                t_first_chunk = time.perf_counter()
            buffer += chunk
            lines, buffer = parse_sse_lines(buffer)
            for line in lines:
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                except Exception:
                    continue
                if t_first_milestone is None and data.get("type") == "thought":
                    content = data.get("content", "")
                    if "[MILESTONE]" in content or "[PHASE]" in content:
                        t_first_milestone = time.perf_counter()
                if data.get("type") == "done":
                    t_done = time.perf_counter()
                    return {
                        "case": case["name"],
                        "ttfb_ms": round((t_first_chunk - t0) * 1000, 1) if t_first_chunk else None,
                        "ttfm_ms": round((t_first_milestone - t0) * 1000, 1) if t_first_milestone else None,
                        "total_ms": round((t_done - t0) * 1000, 1) if t_done else None
                    }

    return {
        "case": case["name"],
        "ttfb_ms": None,
        "ttfm_ms": None,
        "total_ms": None
    }


async def main():
    results = []
    async with httpx.AsyncClient() as client:
        for case in CASES:
            result = await run_case(client, case)
            results.append(result)

    print(f"Latency results (ms), timeout={int(MAX_SECONDS)}s:")
    for r in results:
        print(f"- {r['case']}: TTFB={r['ttfb_ms']}, TTFM={r['ttfm_ms']}, Total={r['total_ms']}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
