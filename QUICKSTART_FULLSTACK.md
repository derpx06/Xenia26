# 🚀 Quick Start - Full Stack Integration

## Run Both Frontend and Backend

### Terminal 1: Start Backend (FastAPI + LangGraph Agent)

```bash
cd /home/manas/Documents/Xenia26/fastapi
uv run uvicorn main:app --reload
```

**Backend URL**: `http://localhost:8000`

✅ Check it's running:
```bash
curl http://localhost:8000
# Should return: {"message": "Xenia26 Backend API", "status": "running"}
```

---

### Terminal 2: Start Frontend (React + Vite)

```bash
cd /home/manas/Documents/Xenia26/Frontend
npm run dev
```

**Frontend URL**: `http://localhost:5173` (or check terminal output)

---

## Test the Integration

1. **Open Browser**: Navigate to `http://localhost:5173`

2. **Navigate to Chat**: Click "Outreach" in sidebar or go to `/outreach`

3. **Try These Queries**:

   **Simple Question**:
   ```
   What is 2 + 2?
   ```
   Expected: Direct answer, no tools

   **Web Search**:
   ```
   Search for latest news about Python programming
   ```
   Expected: Tool indicator → Search results → Summary

   **Article Scraping**:
   ```
   Scrape and summarize this article: https://en.wikipedia.org/wiki/Artificial_intelligence
   ```
   Expected: Tool indicator → Article content → Summary

   **Conversation**:
   ```
   User: Tell me about FastAPI
   Agent: [Response]
   User: How does it compare to Flask?
   ```
   Expected: Context-aware response

---

## Visual Indicators

### ✨ While Processing

| Indicator | What It Means |
|-----------|---------------|
| "AI Agent is thinking..." | Initial processing |
| Purple wrench icon spinning | Using tool (search/scrape) |
| Streaming text with blinking cursor | Response being generated |

### ✅ Complete

Message appears in chat history with proper formatting

---

## Quick Demo Commands

```bash
# 1. Start backend
cd /home/manas/Documents/Xenia26/fastapi && uv run uvicorn main:app --reload

# 2. In another terminal, start frontend
cd /home/manas/Documents/Xenia26/Frontend && npm run dev

# 3. Open browser to http://localhost:5173/outreach
```

---

## Troubleshooting

### Backend not starting?
```bash
# Make sure Ollama is running
ollama list

# Pull the model if needed
ollama pull mistral:7b
```

### CORS errors?
- Check that CORS is configured in `fastapi/main.py` (✅ Already added!)
- Verify frontend URL matches allowed origins

### No response in chat?
1. Check browser console (F12) for errors
2. Check backend terminal for request logs
3. Verify both servers are running
4. Test backend directly: `curl http://localhost:8000/ml/models`

---

## 📝 What's Integrated

- ✅ Real-time streaming responses
- ✅ DuckDuckGo web search tool
- ✅ Web article scraper tool
- ✅ Conversation history
- ✅ Tool call indicators
- ✅ Error handling
- ✅ CORS configured
- ✅ Mistral 7B model

**You're all set!** 🎉
