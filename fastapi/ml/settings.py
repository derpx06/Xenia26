"""Application settings loaded from environment variables"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
# Load environment variables from .env file
# Adjusted to look in the current directory or parent directories if needed
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


class Settings:
    """Application settings"""
    
    def __init__(self):
        # Model settings
        self.LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
        self.model_name = os.getenv("MODEL_NAME", "qwen2.5:7b")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.TEXT_EMBEDDING_MODEL_ID = os.getenv("TEXT_EMBEDDING_MODEL_ID", "sentence-transformers/all-MiniLM-L6-v2")
        self.RAG_MODEL_DEVICE = os.getenv("RAG_MODEL_DEVICE", "cpu")
        self.RERANKING_CROSS_ENCODER_MODEL_ID = os.getenv("RERANKING_CROSS_ENCODER_MODEL_ID", "cross-encoder/ms-marco-MiniLM-L-6-v2")
        
        # Database settings
        self.MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.DATABASE_NAME = os.getenv("DATABASE_NAME", "ml_database")
        
        # LinkedIn settings (optional - for automated login)
        # LinkedIn settings (optional - for automated login)
        self.LINKEDIN_USERNAME = os.getenv("LINKEDIN_USERNAME", "xeniasampleuser@gmail.com")
        self.LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "xeniaUserPassword")
        self.LINKEDIN_HEADLESS = os.getenv("LINKEDIN_HEADLESS", "false").lower() == "true"
        
        # OpenAI settings
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        self.OPENAI_MODEL_ID = os.getenv("OPENAI_MODEL_ID", "gpt-4")
        self.OPENAI_MAX_TOKEN_WINDOW = int(os.getenv("OPENAI_MAX_TOKEN_WINDOW", "8192"))

        # LangSmith Configuration
        self.LANGCHAIN_TRACING_V2 = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true"
        self.LANGCHAIN_API_KEY = os.getenv("LANGCHAIN_API_KEY")
        self.LANGCHAIN_PROJECT = os.getenv("LANGCHAIN_PROJECT", "Deep-Psych Agent")


settings = Settings()

