"""MongoDB database connection"""

from loguru import logger
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

from ml.settings import settings


class MongoConnection:
    """MongoDB database connection manager"""
    
    def __init__(self):
        self._client = None
        self._connect()
    
    def _connect(self):
        """Establish connection to MongoDB"""
        try:
            mongo_uri = settings.MONGO_URI
            logger.info(f"Connecting to MongoDB at {mongo_uri}")
            self._client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            # Test the connection
            self._client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            logger.warning("Database operations will fail. Please ensure MongoDB is running.")
            self._client = None
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {e}")
            self._client = None
    
    def get_database(self, name):
        """Get database by name"""
        if self._client is None:
            logger.error("MongoDB client not initialized. Cannot get database.")
            return None
        
        try:
            return self._client[name]
        except Exception as e:
            logger.error(f"Failed to get database '{name}': {e}")
            return None
    
    def close(self):
        """Close MongoDB connection"""
        if self._client:
            self._client.close()
            logger.info("MongoDB connection closed")


connection = MongoConnection()

