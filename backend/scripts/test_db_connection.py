"""
Test MongoDB database connection
"""

import sys
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

logger.info("Testing MongoDB connection...")

try:
    from ml.infrastructure.db.mongo import connection
    from ml.settings import settings
    
    print("\n" + "="*60)
    print("MongoDB Connection Test")
    print("="*60)
    
    # Get database
    db = connection.get_database(settings.DATABASE_NAME)
    
    if db is None:
        print("❌ Failed to connect to MongoDB")
        print("\nPlease ensure MongoDB is running:")
        print("  bash scripts/start_mongodb.sh")
        exit(1)
    
    # List collections
    collections = db.list_collection_names()
    
    print(f"\n✅ Successfully connected to MongoDB!")
    print(f"Database: {settings.DATABASE_NAME}")
    print(f"URI: {settings.MONGO_URI}")
    print(f"\nExisting collections ({len(collections)}):")
    
    if collections:
        for coll in collections:
            count = db[coll].count_documents({})
            print(f"  - {coll}: {count} documents")
    else:
        print("  (No collections yet)")
    
    print("\n" + "="*60)
    print("Connection test completed successfully!")
    print("="*60 + "\n")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
