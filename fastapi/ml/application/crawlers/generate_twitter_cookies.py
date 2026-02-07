from twikit import Client
import json

client = Client(language="en-US")

client.login(
    auth_info_1="YOUR_EMAIL",
    auth_info_2="YOUR_USERNAME",
    password="YOUR_PASSWORD"
)

cookies = client.get_cookies()

with open("twitter_cookies.json", "w", encoding="utf-8") as f:
    json.dump(cookies, f, indent=2)

print("✅ twitter_cookies.json generated successfully")
