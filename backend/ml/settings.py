# Settings module stub
# TODO: Implement actual settings configuration

class Settings:
    """Stub for application settings"""
    def __init__(self):
        self.model_name = "gemma3:4b"
        self.embedding_model = "sentence-transformers/all-MiniLM-L6-v2"
        self.TEXT_EMBEDDING_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
        self.RAG_MODEL_DEVICE = "cpu"
        self.RERANKING_CROSS_ENCODER_MODEL_ID = "cross-encoder/ms-marco-MiniLM-L-6-v2"
        self.DATABASE_NAME = "ml_database"
        self.OPENAI_API_KEY = None
        self.OPENAI_MODEL_ID = "gpt-4"
        self.OPENAI_MAX_TOKEN_WINDOW = 8192
        # Add other settings as needed

settings = Settings()
