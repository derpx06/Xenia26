# LangGraph Agent with Tool Calling

A sophisticated AI agent built with LangGraph, featuring tool calling capabilities, web search, article scraping, and efficient streaming responses.

## 🚀 Features

- **LangGraph-powered agent** with state management and conditional routing
- **Ollama integration** for local LLM inference
- **DuckDuckGo web search** tool for retrieving current information
- **Web article scraper** tool using the existing CustomArticleCrawler
- **Efficient streaming** for real-time agent thoughts and responses
- **FastAPI endpoints** with both streaming and synchronous modes
- **Conversation history** support for contextual responses

## 📁 Project Structure

```
ml/application/agent/
├── __init__.py           # Package initialization
├── schemas.py            # Pydantic models for requests/responses
├── tools.py              # DuckDuckGo search and web scraper tools
├── graph.py              # LangGraph state machine and agent logic
├── streaming.py          # Efficient streaming implementation
├── test_tools.py         # Unit tests for tools
└── test_agent.py         # Integration tests for agent
```

## 🔧 Tools

### 1. DuckDuckGo Search
Searches the web and returns top results with titles, snippets, and URLs.

```python
from ml.application.agent.tools import duckduckgo_search

result = duckduckgo_search("latest AI news")
```

### 2. Web Article Scraper
Extracts content from web articles including title and main text.

```python
from ml.application.agent.tools import scrape_article

content = scrape_article("https://example.com/article")
```

## 🌐 API Endpoints

### Streaming Endpoint
**POST** `/ml/agent/chat`

Stream agent responses with real-time updates including thoughts, tool calls, and results.

```bash
curl -N -X POST http://localhost:8000/ml/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Search for latest Python news and summarize",
    "model": "gemma2:2b",
    "max_iterations": 10
  }'
```

**Response Stream (SSE):**
```json
data: {"type":"thought","content":"I need to search for Python news..."}
data: {"type":"tool_call","tool_name":"duckduckgo_search","content":"Using tool: duckduckgo_search"}
data: {"type":"tool_result","tool_name":"duckduckgo_search","content":"Tool result received"}
data: {"type":"done","content":"Agent execution completed","metadata":{"iterations":3,"tool_calls":1}}
```

### Synchronous Endpoint
**POST** `/ml/agent/chat-sync`

Returns the complete agent response after all processing is done.

```bash
curl -X POST http://localhost:8000/ml/agent/chat-sync \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the capital of France?",
    "model": "gemma2:2b"
  }'
```

**Response:**
```json
{
  "response": "The capital of France is Paris.",
  "tool_calls": [],
  "iterations": 1,
  "model": "gemma2:2b"
}
```

## 🧪 Testing

### 1. Test Tools
```bash
cd /home/manas/Documents/Xenia26/fastapi
uv run python test_tools_standalone.py
```

### 2. Test Agent (requires running server)
```bash
cd /home/manas/Documents/Xenia26/fastapi
uv run python ml/application/agent/test_agent.py
```

### 3. Test API Endpoints (Bash)
```bash
cd /home/manas/Documents/Xenia26/fastapi
# Make sure server is running first
./test_agent_api.sh
```

### 4. Test API Endpoints (Python Client)
```bash
cd /home/manas/Documents/Xenia26/fastapi
uv run python test_agent_client.py

# Or with custom message:
uv run python test_agent_client.py "Search for LangGraph documentation"
```

## 🏃 Running the Server

First, ensure all dependencies are installed:
```bash
cd /home/manas/Documents/Xenia26/fastapi
uv sync
```

Then start the server:
```bash
uv run uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

**Note:** Make sure Ollama is running and has the required model:
```bash
# Check if Ollama is running
ollama list

# Pull the default model if needed
ollama pull gemma2:2b
```

## 📝 Request Schema

```python
{
    "message": str,                    # Required: User's message
    "model": str = "gemma2:2b",       # Optional: Ollama model to use
    "conversation_history": [          # Optional: Previous messages
        {
            "role": "user|assistant",
            "content": str
        }
    ],
    "max_iterations": int = 10         # Optional: Max agent iterations
}
```

## 🎯 Example Use Cases

1. **Web Search & Summary**
   - "Search for the latest developments in quantum computing"
   
2. **Article Analysis**
   - "Scrape this article and summarize the key points: https://example.com/article"
   
3. **Research Assistant**
   - "Find recent papers on machine learning and list the main findings"

4. **Fact Checking**
   - "Search for information about climate change and provide sources"

## ⚙️ Configuration

- **Model**: Change the default model by setting `model` in requests (default: `gemma2:2b`)
- **Max Iterations**: Prevent infinite loops by setting `max_iterations` (default: 10)
- **Temperature**: Modify in `graph.py` (currently 0.7)

## 🔍 How It Works

1. **User sends message** → Agent receives and analyzes
2. **Agent decides** → Use tools or respond directly
3. **Tool execution** → DuckDuckGo search or article scraping
4. **Processing** → Agent synthesizes tool results
5. **Response** → Streams back to user in real-time

## 🛠️ Dependencies

- `langgraph` - Agent orchestration
- `langchain-ollama` - Ollama LLM integration
- `duckduckgo-search` - Web search functionality
- `langchain-community` - HTML loading and transformation
- `fastapi` - API framework
- `ollama` - Local LLM inference
