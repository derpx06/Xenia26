# 📮 Postman Guide - LangGraph Agent API

This guide shows you how to test the LangGraph agent API endpoints using Postman.

## Prerequisites

1. **Start the FastAPI server**
   ```bash
   cd /home/manas/Documents/Xenia26/fastapi
   uv run uvicorn main:app --reload
   ```
   Server runs at: `http://localhost:8000`

2. **Ensure Ollama is running** with the model
   ```bash
   ollama list
   ollama pull gemma2:2b  # if needed
   ```

---

## 🔧 Endpoint 1: Synchronous Chat (Easiest to Test)

**Recommended for beginners** - Returns complete response in one JSON object.

### Setup in Postman

1. **Create a new request**
   - Click "New" → "HTTP Request"
   - Name it: `Agent Chat - Sync`

2. **Configure Request**
   - **Method**: `POST`
   - **URL**: `http://localhost:8000/ml/agent/chat-sync`

3. **Set Headers**
   - Click "Headers" tab
   - Add header:
     - **Key**: `Content-Type`
     - **Value**: `application/json`

4. **Set Request Body**
   - Click "Body" tab
   - Select "raw"
   - Select "JSON" from dropdown (right side)
   - Enter JSON:

   ```json
   {
     "message": "What is the capital of France?",
     "model": "gemma2:2b",
     "max_iterations": 10
   }
   ```

5. **Send Request**
   - Click the blue "Send" button
   - Wait for response (may take 5-30 seconds depending on query)

### Expected Response

```json
{
  "response": "The capital of France is Paris.",
  "tool_calls": [],
  "iterations": 1,
  "model": "gemma2:2b"
}
```

### Example Requests to Try

#### Simple Question (No Tools)
```json
{
  "message": "What is 2 + 2?",
  "model": "gemma2:2b"
}
```

#### Web Search Question
```json
{
  "message": "Search for the latest news about Python programming language",
  "model": "gemma2:2b",
  "max_iterations": 10
}
```

**Expected Response:**
```json
{
  "response": "Based on my search results, here are the latest developments in Python...",
  "tool_calls": [
    {
      "name": "duckduckgo_search",
      "input": {
        "query": "latest news about Python programming language"
      }
    }
  ],
  "iterations": 2,
  "model": "gemma2:2b"
}
```

#### Article Scraping Question
```json
{
  "message": "Scrape this article and summarize: https://en.wikipedia.org/wiki/Python_(programming_language)",
  "model": "gemma2:2b",
  "max_iterations": 10
}
```

#### With Conversation History
```json
{
  "message": "What about JavaScript?",
  "model": "gemma2:2b",
  "conversation_history": [
    {
      "role": "user",
      "content": "Tell me about Python"
    },
    {
      "role": "assistant",
      "content": "Python is a high-level programming language..."
    }
  ]
}
```

---

## 🌊 Endpoint 2: Streaming Chat (Advanced)

**For real-time updates** - Streams agent thoughts and tool calls as they happen.

### Setup in Postman

1. **Create a new request**
   - Click "New" → "HTTP Request"
   - Name it: `Agent Chat - Stream`

2. **Configure Request**
   - **Method**: `POST`
   - **URL**: `http://localhost:8000/ml/agent/chat`

3. **Set Headers**
   - **Key**: `Content-Type`
   - **Value**: `application/json`

4. **Set Request Body**
   ```json
   {
     "message": "Search for latest AI developments and summarize",
     "model": "gemma2:2b",
     "max_iterations": 10
   }
   ```

5. **Send Request**
   - Click "Send"
   - Response will stream in real-time

### Understanding the Stream Response

The response comes as **Server-Sent Events (SSE)** with multiple chunks:

```
data: {"type":"thought","content":"I need to search for AI developments...","tool_name":null,"tool_input":null,"tool_output":null,"metadata":null}

data: {"type":"tool_call","content":"Using tool: duckduckgo_search","tool_name":"duckduckgo_search","tool_input":{"query":"latest AI developments"},"tool_output":null,"metadata":null}

data: {"type":"tool_result","content":"Tool result received","tool_name":"duckduckgo_search","tool_output":"Search Results:\n\n1. **AI Breakthrough...\n","metadata":null}

data: {"type":"thought","content":"Based on the search results, here's a summary...","tool_name":null,"tool_input":null,"tool_output":null,"metadata":null}

data: {"type":"done","content":"Agent execution completed","tool_name":null,"tool_input":null,"tool_output":null,"metadata":{"iterations":2,"tool_calls":1}}
```

### Stream Chunk Types

| Type | Description | Example Use |
|------|-------------|-------------|
| `thought` | Agent's reasoning process | "I need to search for..." |
| `tool_call` | Agent invoking a tool | Using duckduckgo_search |
| `tool_result` | Result from tool execution | Search results data |
| `response` | Final response chunk | The complete answer |
| `error` | Error occurred | Tool failed or timeout |
| `done` | Stream completion | Final metadata |

---

## 📚 Complete Request Schema

### Required Fields
- **message** (string): Your question or instruction to the agent

### Optional Fields
- **model** (string, default: "gemma2:2b"): Ollama model to use
- **conversation_history** (array): Previous messages for context
- **max_iterations** (integer, default: 10): Maximum reasoning iterations

### Full Example
```json
{
  "message": "Search for Python tutorials and tell me about the best one",
  "model": "gemma2:2b",
  "conversation_history": [
    {
      "role": "user",
      "content": "What programming languages should I learn?"
    },
    {
      "role": "assistant",
      "content": "I recommend starting with Python because..."
    }
  ],
  "max_iterations": 15
}
```

---

## 🎯 Common Use Cases with Examples

### 1. Simple Q&A (No Tools Needed)

**Request:**
```json
{
  "message": "Explain what is a REST API in simple terms",
  "model": "gemma2:2b"
}
```

**What Happens:**
- Agent responds directly without using tools
- Fast response (2-5 seconds)
- No tool_calls in response

---

### 2. Web Search + Summary

**Request:**
```json
{
  "message": "What are the latest developments in quantum computing?",
  "model": "gemma2:2b",
  "max_iterations": 10
}
```

**What Happens:**
1. Agent decides to use DuckDuckGo search tool
2. Searches web for "quantum computing developments"
3. Receives search results
4. Synthesizes and summarizes results
5. Returns final answer

**Tool Used:** `duckduckgo_search`

---

### 3. Article Analysis

**Request:**
```json
{
  "message": "Read this article and give me key points: https://en.wikipedia.org/wiki/Machine_learning",
  "model": "gemma2:2b"
}
```

**What Happens:**
1. Agent uses scrape_article tool
2. Fetches article content
3. Analyzes and extracts key points
4. Returns summary

**Tool Used:** `scrape_article`

---

### 4. Research Assistant (Multiple Tools)

**Request:**
```json
{
  "message": "Find recent articles about LangChain, scrape the top result, and summarize it",
  "model": "gemma2:2b",
  "max_iterations": 15
}
```

**What Happens:**
1. Agent searches for "LangChain articles"
2. Gets search results
3. Picks top result URL
4. Scrapes that article
5. Summarizes the content

**Tools Used:** `duckduckgo_search` → `scrape_article`

---

### 5. Multi-Turn Conversation

**First Request:**
```json
{
  "message": "Search for information about FastAPI",
  "model": "gemma2:2b"
}
```

**Second Request (with history):**
```json
{
  "message": "How does it compare to Flask?",
  "model": "gemma2:2b",
  "conversation_history": [
    {
      "role": "user",
      "content": "Search for information about FastAPI"
    },
    {
      "role": "assistant",
      "content": "FastAPI is a modern, fast web framework for Python..."
    }
  ]
}
```

---

## 🔍 Troubleshooting in Postman

### Issue: Connection Refused
**Error:** `Error: connect ECONNREFUSED 127.0.0.1:8000`

**Solution:**
- Make sure server is running: `uv run uvicorn main:app --reload`
- Check the URL is correct: `http://localhost:8000`

---

### Issue: 503 Service Unavailable
**Error:** `Failed to connect to Ollama service`

**Solution:**
- Check Ollama is running: `ollama list`
- Pull the model: `ollama pull gemma2:2b`
- Try a different model you have installed

---

### Issue: 500 Internal Server Error
**Possible Causes:**
1. Invalid JSON in request body
2. Wrong field names
3. Model not found in Ollama

**Solution:**
- Check JSON syntax is valid
- Verify field names match schema
- Try default model: "gemma2:2b"

---

### Issue: Request Takes Too Long
**Timeout or slow response**

**Solution:**
- Reduce `max_iterations` to 5-8
- Use a smaller/faster model
- Check internet connection (for web search/scraping)
- Simplify the query

---

## 💡 Pro Tips

### 1. Save Requests as Collection
- Create a Postman Collection: "LangGraph Agent"
- Save different request types as templates
- Add environment variables for base URL

### 2. Use Environment Variables
```
BASE_URL = http://localhost:8000
```
Then use: `{{BASE_URL}}/ml/agent/chat-sync`

### 3. Test Different Models
Available Ollama models (if you have them):
- `gemma2:2b` - Fast, lightweight
- `llama3.1:8b` - Better quality
- `mistral:7b` - Good balance
- `qwen2.5:7b` - Efficient

### 4. Monitor Server Logs
Keep an eye on the terminal running the server to see:
- Tool calls being made
- Errors and warnings
- Processing steps

### 5. Use Postman's Tests Tab
Add tests to validate responses:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has required fields", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('response');
    pm.expect(jsonData).to.have.property('model');
});
```

---

## 📊 Sample Postman Collection Structure

```
📁 LangGraph Agent
├── 📄 Agent Chat - Sync (Simple)
├── 📄 Agent Chat - Sync (Web Search)
├── 📄 Agent Chat - Sync (Article Scrape)
├── 📄 Agent Chat - Sync (Conversation)
├── 📄 Agent Chat - Stream (Real-time)
└── 📄 Get Available Models
```

---

## 🎬 Quick Start Video (Manual Steps)

1. Open Postman
2. New → HTTP Request
3. POST to `http://localhost:8000/ml/agent/chat-sync`
4. Headers: `Content-Type: application/json`
5. Body → raw → JSON:
   ```json
   {
     "message": "What is LangGraph?",
     "model": "gemma2:2b"
   }
   ```
6. Click Send
7. See response! 🎉

---

## 📝 Response Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | Success | Request processed successfully |
| 422 | Validation Error | Invalid request format |
| 500 | Server Error | Agent execution failed |
| 503 | Service Unavailable | Ollama not running |

---

## 🚀 Next Steps

1. ✅ Test the sync endpoint with a simple question
2. ✅ Try a web search query
3. ✅ Test article scraping
4. ✅ Experiment with streaming endpoint
5. ✅ Build a multi-turn conversation
6. ✅ Create your own use cases!

## 📖 Additional Resources

- **API Documentation**: `http://localhost:8000/docs` (when server is running)
- **Full Guide**: [README.md](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/README.md)
- **Quick Start**: [QUICKSTART.md](file:///home/manas/Documents/Xenia26/fastapi/QUICKSTART.md)

Happy testing! 🎉
