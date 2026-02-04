from fastapi import APIRouter, HTTPException
import ollama

router = APIRouter(prefix="/ml", tags=["ML"])

@router.get("/models")
def get_ollama_models():
    """
    Get the list of available Ollama models and return the count.
    """
    try:
        # List all available models from Ollama
        models_response = ollama.list()
        
        # Extract model names from the response
        # ollama.list() returns a ListResponse object with a 'models' attribute
        model_names = [model.model for model in models_response.models]
        
        return {
            "count": len(model_names),
            "models": model_names
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Ollama service: {str(e)}"
        )
