from pprint import pprint

from ml.application.crawlers.github import GithubProfileCrawler
from ml.application.crawlers.twitter import TwitterProfileCrawler
from ml.application.crawlers.linkedin import LinkedInCrawler
from ml.application.crawlers.medium import MediumCrawler
from ml.application.crawlers.custom_article import CustomArticleCrawler


def run(name, crawler, target):
    print("\n" + "=" * 60)
    print(f"🚀 RUNNING {name}")
    print(f"🎯 TARGET: {target}")
    print("=" * 60)

    try:
        result = crawler.extract(target)

        print("\n✅ SUCCESS — OUTPUT:\n")
        pprint(result)

        if isinstance(result, dict):
            print("\n📊 SUMMARY")
            if "profile" in result:
                print("Profile keys:", list(result["profile"].keys()))
            if "posts" in result:
                print("Posts extracted:", len(result["posts"]))
            if "top_tweets" in result:
                print("Top tweets:", len(result["top_tweets"]))

    except Exception as e:
        print("\n❌ FAILED")
        print(type(e).__name__, ":", e)


def main():
    # --------------------
    # GitHub
    # --------------------
    # run(
    #     "GitHubProfileCrawler",
    #     GithubProfileCrawler(),
    #     "torvalds",
    # )

    # --------------------
    # Twitter / X
    # (requires valid twitter_cookies.json)
    # --------------------
    # run(
    #     "TwitterProfileCrawler",
    #     TwitterProfileCrawler(),
    #     "Rainmaker1973",
    # )

    # # --------------------
    # # LinkedIn
    # # (requires cookies OR username/password in settings)
    # # --------------------
    # run(
    #     "LinkedInCrawler",
    #     LinkedInCrawler(scroll_limit=5, cookies_file="linkedin_cookies.json"),
    #     "https://www.linkedin.com/in/vishal-autade-b0191227b/",
    # )

    # # --------------------
    # # Medium
    # # --------------------
    # run(
    #     "MediumCrawler",
    #     MediumCrawler(),
    #     "https://medium.com/@theyashwanthsai/i-have-built-around-300-agents-worked-at-5-startups-heres-what-i-learnt-about-ai-agent-e911ffa62682",
    # )

    # --------------------
    # Custom Article
    # --------------------
    run(
        "CustomArticleCrawler",
        CustomArticleCrawler(),
        "https://medium.com/@theyashwanthsai/i-have-built-around-300-agents-worked-at-5-startups-heres-what-i-learnt-about-ai-agent-e911ffa62682",
    )


if __name__ == "__main__":
    main()
