import re

def _canonical_topic_from_text(text):
    # Mock implementation for testing
    return None

def _extract_topic_focus(topic_text: str) -> str:
    text = str(topic_text or "").strip()
    if not text:
        return ""

    # Strip common instruction prefixes
    pattern = r"^(?:write|draft|create|generate)\s+(?:a|an)\s+(?:thought leadership\s+)?(?:article|blog post|essay|paper|report|guide)\s+(?:about|on|regarding)\s+"
    print(f"Testing pattern: {pattern}")
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
        print(f"Match found: '{match.group(0)}'")
        candidate = text[match.end():].strip()
        if candidate:
            return candidate
    else:
        print("No match found")

    return text

test_cases = [
    "Write a thought leadership article about the future of AI in sales.",
    "Draft an article about deep learning.",
    "Create a blog post on marketing strategies.",
    "Generate a report regarding Q3 financial results.",
    "Write a thought leadership article about the future of AI in sales.\n\nAdditional instructions...",
]

for i, test in enumerate(test_cases):
    print(f"\n--- Test Case {i+1} ---")
    print(f"Input: '{test}'")
    result = _extract_topic_focus(test)
    print(f"Result: '{result}'")
