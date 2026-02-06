# 🔗 Frontend-Backend Integration Guide

## ✅ Integration Complete!

The Frontend OutreachChat component is now **fully integrated** with your FastAPI LangGraph agent backend using **real-time streaming**.

---

## 🎯 What Was Integrated

### Backend API Endpoint
- **URL**: `http://localhost:8000/ml/agent/chat`
- **Method**: POST
- **Type**: Server-Sent Events (SSE) Streaming
- **Model**: mistral:7b

### Frontend Component
- **File**: [`OutreachChat.jsx`](file:///home/manas/Documents/Xenia26/Frontend/src/pages/OutreachChat.jsx)
- **API Base URL**: `http://localhost:8000` (configurable constant)

---

## 🚀 New Features Added

### 1. **Real-Time Streaming** ⚡
- Agent responses stream in real-time as they're generated
- Progressive text rendering with typing indicator
- Smooth UX with no waiting for complete responses

### 2. **Tool Call Indicators** 🔧
- Visual indicator when agent uses tools (DuckDuckGo search, web scraping)
- Shows tool name and input parameters
- Purple animated icon during tool execution

### 3. **Conversation History** 💬
- Sends previous messages to maintain context
- Filters only text messages (excludes drafts)
- Proper role mapping (user/assistant)

### 4. **Error Handling** 🛡️
- Graceful error messages to user
- Helpful backend URL in error messages
- Connection status feedback

### 5. **Enhanced UI** ✨
- Streaming content preview with blinking cursor
- Disabled input during processing
- Updated quick action suggestions
- Better loading states

---

## 📝 How It Works

### Request Flow

```
User types message
    ↓
POST to http://localhost:8000/ml/agent/chat
    ↓
{
  "message": "Search for AI news",
  "model": "mistral:7b",
  "conversation_history": [...],
  "max_iterations": 10
}
    ↓
Server-Sent Events Stream
    ↓
Parse SSE chunks in real-time
    ↓
Update UI progressively
```

### SSE Event Types Handled

| Event Type | UI Update | Visual |
|------------|-----------|--------|
| `thought` | Stream agent reasoning | Typing cursor |
| `tool_call` | Show tool being used | Purple wrench icon |
| `tool_result` | Hide tool indicator | - |
| `response` | Stream final answer | Typing cursor |
| `done` | Finalize message | Remove indicators |
| `error` | Show error message | Error text |

---

## 🧪 Testing the Integration

### 1. Start Backend
```bash
cd /home/manas/Documents/Xenia26/fastapi
uv run uvicorn main:app --reload
```
Server should be at: `http://localhost:8000`

### 2. Start Frontend
```bash
cd /home/manas/Documents/Xenia26/Frontend
npm run dev
```
Usually at: `http://localhost:5173`

### 3. Test Scenarios

#### Simple Question
```
User: "What is 2 + 2?"
Expected: Direct answer, no tools
```

#### Web Search
```
User: "Search for latest AI news"
Expected: 
  1. Tool call indicator (DuckDuckGo)
  2. Search results
  3. Summary response
```

#### Article Scraping
```
User: "Scrape and summarize this: https://en.wikipedia.org/wiki/Artificial_intelligence"
Expected:
  1. Tool call indicator (scrape_article)
  2. Extracted content
  3. Summary
```

#### Multi-turn Conversation
```
User: "Tell me about Python"
Agent: [Response about Python]
User: "How does it compare to JavaScript?"
Expected: Context-aware response
```

---

## 🎨 UI Components

### Streaming Content Preview
```jsx
{streamingContent && (
  <div>
    {streamingContent}
    <span className="blinking-cursor"></span>
  </div>
)}
```

### Tool Call Indicator
```jsx
{currentToolCall && (
  <div className="tool-indicator">
    <Wrench className="animate-spin" />
    <p>Using tool: {currentToolCall.name}</p>
  </div>
)}
```

### Thinking State
```jsx
{thinking && !streamingContent && (
  <div>
    <Sparkles />
    <p>AI Agent is thinking...</p>
  </div>
)}
```

---

## ⚙️ Configuration

### Change Backend URL
Edit the constant in OutreachChat.jsx:
```javascript
const API_BASE_URL = "http://localhost:8000";
// Change to your production URL:
// const API_BASE_URL = "https://api.yourdomain.com";
```

### Change Model
Modify the request body:
```javascript
body: JSON.stringify({
  message: userMessage,
  model: "llama3.1:8b",  // Change model here
  // ...
})
```

### Adjust Max Iterations
```javascript
max_iterations: 15,  // Increase for complex queries
```

---

## 🔍 Debugging

### Check Backend is Running
```bash
curl http://localhost:8000/ml/models
```
Should return list of Ollama models.

### Check CORS (if needed)
If you get CORS errors, add to your FastAPI `main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Browser Console Logs
Open DevTools → Console to see:
- Fetch requests
- SSE parsing
- Error messages

### Network Tab
DevTools → Network → Look for `/ml/agent/chat`:
- Status should be 200
- Type: eventsource or text/event-stream
- Response: streaming chunks

---

## 📊 Quick Action Buttons

Updated suggestions for better demo:
```javascript
[
  "Search for latest AI news",
  "Scrape and summarize article", 
  "Generate outreach message",
  "Analyze trends"
]
```

---

## 🎯 Example Interactions

### Example 1: Web Search
**Input**: "Search for latest AI news"

**Backend Flow**:
1. Agent receives message
2. Decides to use `duckduckgo_search` tool
3. Searches web
4. Synthesizes results
5. Streams response

**Frontend Shows**:
1. "AI Agent is thinking..."
2. Purple tool indicator: "Using tool: duckduckgo_search"
3. Streaming content appears progressively
4. Final message saved to history

### Example 2: Article Analysis
**Input**: "Scrape https://example.com and summarize"

**Backend Flow**:
1. Agent uses `scrape_article` tool
2. Fetches article content
3. Analyzes and summarizes
4. Streams response

**Frontend Shows**:
1. Tool indicator: "Using tool: scrape_article"
2. Streaming summary
3. Complete response

---

## ✅ Checklist

- [x] Backend streaming endpoint working
- [x] Frontend SSE parsing implemented
- [x] Conversation history included
- [x] Tool call indicators added
- [x] Error handling implemented
- [x] Streaming content preview
- [x] Loading states
- [x] Input validation
- [x] Auto-scroll
- [x] Model configured (mistral:7b)

---

## 🚀 Next Steps

1. **Test the integration**:
   ```bash
   # Terminal 1: Start backend
   cd /home/manas/Documents/Xenia26/fastapi && uv run uvicorn main:app --reload
   
   # Terminal 2: Start frontend
   cd /home/manas/Documents/Xenia26/Frontend && npm run dev
   ```

2. **Try sample queries** in the chat interface

3. **Monitor both terminals** for logs

4. **Check browser console** for any errors

---

## 📖 Related Files

- [OutreachChat.jsx](file:///home/manas/Documents/Xenia26/Frontend/src/pages/OutreachChat.jsx) - Frontend chat component
- [ml/routes.py](file:///home/manas/Documents/Xenia26/fastapi/ml/routes.py) - Backend API routes
- [Frontend Architecture](file:///home/manas/Documents/Xenia26/Frontend/FRONTEND_ARCHITECTURE.md) - Full frontend docs
- [Postman Guide](file:///home/manas/Documents/Xenia26/fastapi/POSTMAN_GUIDE.md) - API testing guide

---

**Status**: ✅ **Ready to use!** The chat is now connected to your LangGraph agent with real-time streaming.
