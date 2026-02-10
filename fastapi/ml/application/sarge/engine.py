"""
SARGE Engine - Single model instance with preset configurations
"""
from langchain_ollama import ChatOllama
import httpx
from ml.settings import settings
from loguru import logger
import instructor
import openai


class SARGEEngine:
    """
    Single-Model Adaptive Routing & Generation Engine
    One model, three execution presets
    """
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.LLM_MODEL
        logger.info(f"🚀 SARGE: Initializing with model {self.model_name}")
        
        # Shared HTTP client to prevent socket leaks (ResourceWarning)
        self._async_client = httpx.AsyncClient(
            base_url="http://localhost:11434",
            timeout=httpx.Timeout(60.0)
        )
        
        # Shared instructor client to prevent socket leaks
        self._async_openai_client = openai.AsyncOpenAI(
            base_url="http://localhost:11434/v1",
            api_key="ollama",
            http_client=self._async_client
        )
        self._instructor_client = instructor.from_openai(
            self._async_openai_client,
            mode=instructor.Mode.JSON
        )
        
        # Pre-initialize all model instances to prevent socket leaks
        self._router_model = ChatOllama(
            model=self.model_name,
            temperature=0.0,
            async_client=self._async_client,
            streaming=True
        )
        self._analyst_model = ChatOllama(
            model=self.model_name,
            temperature=0.1,
            async_client=self._async_client,
            streaming=True
        )
        self._creative_model = ChatOllama(
            model=self.model_name,
            temperature=0.7,
            async_client=self._async_client,
            streaming=True
        )
    
    @property
    def router(self) -> ChatOllama:
        """ Preset A: The Router """
        return self._router_model
    
    @property
    def analyst(self) -> ChatOllama:
        """ Preset B: The Analyst """
        return self._analyst_model
    
    @property
    def creative(self) -> ChatOllama:
        """ Preset C: The Creative """
        return self._creative_model

    @property
    def structured(self) -> instructor.Instructor:
        """
        Shared instructor client for structured output
        """
        return self._instructor_client


# Global singleton instance
_engine = None

def get_engine() -> SARGEEngine:
    """Get or create the SARGE engine singleton"""
    global _engine
    if _engine is None:
        _engine = SARGEEngine()
    return _engine
