"""LLM provider setup and configuration using LangChain model factories."""

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

# Load environment variables from .env file
load_dotenv()


import instructor

def get_llm(provider: str, model: str | None = None, temperature: float = 0.7):
    """Get the appropriate LLM instance using LangChain's model factory.

    Args:
        provider: Model provider (openai, anthropic, google_genai)
        model: Model name. If None, will use provider defaults.
        temperature: Model temperature (0.0 to 1.0). Defaults to 0.7.

    Returns:
        ChatModel instance
    """

    # Set default models for each provider if not specified
    if model is None:
        default_models = {
            "openai": "gpt-3.5-turbo",
            "anthropic": "claude-3-haiku-20240307",
            "google_genai": "gemini-1.5-flash",
            "ollama": "qwen2.5:7b",
        }
        model = default_models.get(provider)

    # Use LangChain's model factory with automatic provider inference
    # The factory will handle API key loading automatically from environment variables
    return init_chat_model(
        model=model, model_provider=provider, temperature=temperature
    )
    

def get_instructor_client(provider: str, model: str | None = None, temperature: float = 0.7):
    """Get an instructor-patched client for structured output.
    
    Args:
        provider: Model provider (openai, anthropic, google_genai, ollama)
        model: Model name. If None, will use provider defaults.
        temperature: Model temperature.
        
    Returns:
        Instructor patched client
    """
    
    # Set default models
    if model is None:
        default_models = {
            "ollama": "qwen2.5:7b",
        }
        model = default_models.get(provider)
        
    if provider == "ollama":
        # Use simple from_provider syntax as recommended in docs
        # Note: 'ollama' provider string usually needs to be 'ollama/model_name'
        client = instructor.from_provider(
            f"ollama/{model}",
            mode=instructor.Mode.JSON
        )
        return client, model
        
    elif provider == "openai":
        client = instructor.from_provider("openai/gpt-3.5-turbo") # Example
        return client, model
        
    else:
        # Generic fallback
        try:
             client = instructor.from_provider(f"{provider}/{model}")
             return client, model
        except Exception:
             raise ValueError(f"Provider {provider} not fully supported for structured output yet.")
