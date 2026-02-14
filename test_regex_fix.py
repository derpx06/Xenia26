
import sys
import os
import re

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'fastapi')))

from ml.ollama_deep_researcher.nodes import _tokenize_keywords, _compact_search_query

def test_fix():
    topic = "future of AI in sales"
    
    print(f"Original Topic: '{topic}'")
    
    # Test tokenization
    tokens = _tokenize_keywords(topic)
    print(f"Tokens: {tokens}")
    
    # Test compact query
    query = _compact_search_query(topic)
    print(f"Compact Query: '{query}'")
    
    if "ai" in [t.lower() for t in tokens] or "ai" in query.lower():
        print("SUCCESS: 'AI' is preserved.")
    else:
        print("FAILURE: 'AI' is still being stripped.")

if __name__ == "__main__":
    test_fix()
