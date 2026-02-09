"""
SARGE Engine - Single model instance with preset configurations
"""
from langchain_ollama import ChatOllama
from ml.settings import settings
from loguru import logger


class SARGEEngine:
    """
    Single-Model Adaptive Routing & Generation Engine
    One model, three execution presets
    """
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.LLM_MODEL
        logger.info(f"🚀 SARGE: Initializing with model {self.model_name}")
        
        # Base model instance (will be reused with different configs)
        self._base_model = ChatOllama(
            model=self.model_name,
            temperature=0.0  # Default to deterministic
        )
    
    @property
    def router(self) -> ChatOllama:
        """
        Preset A: The Router
        - Temperature: 0.0 (Deterministic)
        - Format: JSON (strict)
        - Role: Intent classification
        """
        return self._base_model.with_config(
            configurable={"temperature": 0.0}
        )
    
    @property
    def analyst(self) -> ChatOllama:
        """
        Preset B: The Analyst
        - Temperature: 0.1 (Very low variance)
        - Format: JSON (structured)
        - Role: Data extraction
        """
        return ChatOllama(
            model=self.model_name,
            temperature=0.1
        )
    
    @property
    def creative(self) -> ChatOllama:
        """
        Preset C: The Creative
        - Temperature: 0.7 (High variance)
        - Format: Text
        - Role: Content generation
        """
        return ChatOllama(
            model=self.model_name,
            temperature=0.7
        )


# Global singleton instance
_engine = None

def get_engine() -> SARGEEngine:
    """Get or create the SARGE engine singleton"""
    global _engine
    if _engine is None:
        _engine = SARGEEngine()
    return _engine
