import asyncio
import os
import sys

# Add ml module to path
sys.path.append(os.getcwd())

from ml.application.agent.tools import scrape_article

async def main():
    url = "https://github.com/torvalds"
    print(f"Testing scrape_article with {url}...")
    try:
        # tool functions are async
        result = await scrape_article.ainvoke(url)
        print("\n✅ Verification SUCCESS")
        print("Result start:", result[:200])
    except Exception as e:
        print("\n❌ Verification FAILED")
        print(e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
