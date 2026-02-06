# 🔧 Changing the Default LLM Model

The default model has been changed to **`mistral:7b`**. Here's everything you need to know:

## ✅ What Was Changed

The default model has been updated from `gemma2:2b` to `mistral:7b` in:

1. ✅ [`ml/application/agent/schemas.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/schemas.py#L14) - Request schema default
2. ✅ [`ml/application/agent/graph.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/graph.py) - All function defaults
3. ✅ [`ml/application/agent/streaming.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/streaming.py#L12) - Streaming function default

## 📋 Prerequisites

Before using `mistral:7b`, make sure you have it installed in Ollama:

```bash
# Check if you have the model
ollama list

# If mistral:7b is not in the list, pull it:
ollama pull mistral:7b
```

## 🎯 Usage

### Option 1: Use Default (No Model Specified)

Now when you don't specify a model, it will automatically use `mistral:7b`:

**Postman Request:**
```json
{
  "message": "What is machine learning?"
}
```

The agent will use `mistral:7b` by default.

### Option 2: Override with Different Model

You can still use any other model by specifying it in the request:

**Use a different model:**
```json
{
  "message": "What is machine learning?",
  "model": "llama3.1:8b"
}
```

**Use the old default:**
```json
{
  "message": "What is machine learning?",
  "model": "gemma2:2b"
}
```

## 🔄 How to Change to Another Model

If you want to change the default to a different model (e.g., `llama3.1:8b`), edit these files:

### 1. Update `schemas.py`
File: [`ml/application/agent/schemas.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/schemas.py)

```python
class AgentRequest(BaseModel):
    model: str = Field(default="llama3.1:8b", description="Ollama model to use")
    # ... rest of the fields
```

### 2. Update `graph.py`
File: [`ml/application/agent/graph.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/graph.py)

Change all three functions:
```python
def create_agent_graph(model_name: str = "llama3.1:8b", ...):
    # ...

def run_agent(message: str, model: str = "llama3.1:8b", ...):
    # ...

async def stream_agent(message: str, model: str = "llama3.1:8b", ...):
    # ...
```

### 3. Update `streaming.py`
File: [`ml/application/agent/streaming.py`](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/streaming.py)

```python
async def stream_agent_response(
    message: str,
    model: str = "llama3.1:8b",
    # ...
):
```

## 🚀 Restart the Server

After changing the default model, restart the FastAPI server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd /home/manas/Documents/Xenia26/fastapi
uv run uvicorn main:app --reload
```

## 📊 Popular Ollama Models

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `gemma2:2b` | 2B | ⚡⚡⚡ Fast | ⭐⭐ Good | Quick responses |
| `mistral:7b` | 7B | ⚡⚡ Medium | ⭐⭐⭐ Great | Balanced |
| `llama3.1:8b` | 8B | ⚡⚡ Medium | ⭐⭐⭐⭐ Excellent | High quality |
| `qwen2.5:7b` | 7B | ⚡⚡ Medium | ⭐⭐⭐ Great | Coding tasks |
| `llama3.2:3b` | 3B | ⚡⚡⚡ Fast | ⭐⭐ Good | Speed priority |

## 🧪 Testing

After changing the model, test it:

```bash
# Sync endpoint
curl -X POST http://localhost:8000/ml/agent/chat-sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what model are you?"}'
```

The response will show which model was used:
```json
{
  "response": "...",
  "model": "mistral:7b",
  "iterations": 1,
  "tool_calls": []
}
```

## 💡 Pro Tips

### 1. Model Performance
- **Smaller models** (2B-3B) = Faster but less accurate
- **Medium models** (7B-8B) = Good balance (recommended)
- **Large models** (13B+) = Best quality but slower

### 2. Memory Considerations
- 2B models: ~2GB RAM
- 7B models: ~5-7GB RAM
- 8B models: ~6-8GB RAM

### 3. Use Different Models for Different Tasks
```json
// Fast simple Q&A
{"message": "What is 2+2?", "model": "gemma2:2b"}

// Complex reasoning
{"message": "Explain quantum physics", "model": "llama3.1:8b"}

// Coding help
{"message": "Write a Python function", "model": "qwen2.5:7b"}
```

## ❓ FAQ

**Q: Will this break existing requests?**
A: No! Requests that specify a model explicitly will continue to work.

**Q: Can I use multiple models?**
A: Yes! Each request can specify a different model.

**Q: What if I don't have mistral:7b?**
A: Run `ollama pull mistral:7b` to download it.

**Q: How do I go back to gemma2:2b?**
A: Either specify it in each request, or change the defaults back.

## 🔗 Related Files

- [Agent Schemas](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/schemas.py)
- [Agent Graph](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/graph.py)
- [Streaming Logic](file:///home/manas/Documents/Xenia26/fastapi/ml/application/agent/streaming.py)
- [Postman Guide](file:///home/manas/Documents/Xenia26/fastapi/POSTMAN_GUIDE.md)
- [Quick Start](file:///home/manas/Documents/Xenia26/fastapi/QUICKSTART.md)

---

**Current Default:** `mistral:7b` ✅
