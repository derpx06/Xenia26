# 🚀 Quick Start Guide - LangGraph Agent

## Prerequisites

1. **Ollama installed and running**
   ```bash
   # Check if Ollama is installed
   ollama --version
   
   # Start Ollama service (if not running)
   # Linux/Mac: Ollama runs as a service automatically
   # Check available models
   ollama list
   ```

2. **Pull the default model**
   ```bash
   ollama pull gemma2:2b
   ```

## Installation & Setup

1. **Navigate to project directory**
   ```bash
   cd /home/manas/Documents/Xenia26/fastapi
   ```

2. **Install dependencies** (if not already done)
   ```bash
   uv sync
   ```
   
   This will install:
   - `duckduckgo-search` - Web search functionality
   - `langchain-ollama` - Ollama integration
   - `langgraph` - Agent orchestration
   - All other required dependencies

## Running the Agent

### Method 1: Start the FastAPI Server

1. **Start the server**
   ```bash
   uv run uvicorn main:app --reload
   ```
   
   Server will be available at: `http://localhost:8000`

2. **Test the streaming endpoint** (in another terminal)
   ```bash
   curl -N -X POST http://localhost:8000/ml/agent/chat \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Search for the latest news about Python",
       "model": "gemma2:2b"
     }'
   ```

3. **Test the synchronous endpoint**
   ```bash
   curl -X POST http://localhost:8000/ml/agent/chat-sync \
     -H "Content-Type: application/json" \
     -d '{
       "message": "What is the capital of France?",
       "model": "gemma2:2b"
     }'
   ```

### Method 2: Use the Python Test Client

```bash
# Run all default tests
uv run python test_agent_client.py

# Or with a custom message
uv run python test_agent_client.py "Search for LangGraph tutorials"
```

### Method 3: Use the Bash Test Script

```bash
./test_agent_api.sh
```

## Testing Individual Components

### Test the Tools (DuckDuckGo & Web Scraper)
```bash
uv run python test_tools_standalone.py
```

### Test the Agent Logic
```bash
# Make sure server is running first!
uv run python ml/application/agent/test_agent.py
```

## Example Queries

Try these example queries with the agent:

### Simple Questions (No Tools)
```json
{
  "message": "What is 2 + 2?",
  "model": "gemma2:2b"
}
```

### Web Search Required
```json
{
  "message": "Search for the latest developments in quantum computing",
  "model": "gemma2:2b"
}
```

### Article Scraping Required
```json
{
  "message": "Scrape and summarize this article: https://en.wikipedia.org/wiki/Artificial_intelligence",
  "model": "gemma2:2b"
}
```

### Combined Search & Scrape
```json
{
  "message": "Search for recent Python tutorials and summarize the best one",
  "model": "gemma2:2b",
  "max_iterations": 15
}
```

## API Endpoints

### Streaming Endpoint
- **URL**: `POST /ml/agent/chat`
- **Returns**: Server-Sent Events stream
- **Use case**: Real-time updates, showing agent thinking process

### Synchronous Endpoint
- **URL**: `POST /ml/agent/chat-sync`
- **Returns**: JSON response
- **Use case**: Simple integrations, batch processing

## Troubleshooting

### Issue: "No module named 'ml'"
**Solution**: Use `uv run` to execute Python scripts in the virtual environment

### Issue: "Failed to connect to Ollama service"
**Solution**: 
1. Check if Ollama is running: `ollama list`
2. Pull the model: `ollama pull gemma2:2b`
3. Restart Ollama service if needed

### Issue: "ModuleNotFoundError: duckduckgo_search"
**Solution**: Install dependencies with `uv sync`

### Issue: Agent takes too long or times out
**Solution**: 
- Reduce `max_iterations` in the request
- Use a faster/smaller Ollama model
- Check your internet connection for web search/scraping

## Next Steps

1. ✅ Start the server: `uv run uvicorn main:app --reload`
2. ✅ Test with provided client: `uv run python test_agent_client.py`
3. ✅ Try custom queries!
4. ✅ Read the full documentation: `ml/application/agent/README.md`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `uv sync` | Install dependencies |
| `uv run uvicorn main:app --reload` | Start server |
| `uv run python test_agent_client.py` | Test agent |
| `uv run python test_tools_standalone.py` | Test tools |
| `./test_agent_api.sh` | Test API with curl |

Happy coding! 🎉
