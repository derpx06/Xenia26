import json
import os
from typing import List, Dict, Optional, Any
from loguru import logger
import chromadb
from chromadb.utils import embedding_functions
from .schemas import ProspectProfile, StrategyBrief

class SimpleKnowledgeBase:
    """
    A persistent Knowledge Base using JSON for structured data (Prospects)
    and ChromaDB for semantic search of unstructured data (Outreach History).
    """
    def __init__(self, storage_dir: str = "ml/application/agent/data"):
        self.storage_dir = storage_dir
        self.prospects_file = os.path.join(storage_dir, "prospects.json")
        self.chroma_dir = os.path.join(storage_dir, "chroma_db")
        
        # Ensure directory exists
        os.makedirs(storage_dir, exist_ok=True)
        
        # 1. Initialize JSON Storage for Prospects
        if not os.path.exists(self.prospects_file):
            with open(self.prospects_file, "w") as f:
                json.dump({}, f)

        self.psych_file = os.path.join(storage_dir, "psych.json")
        if not os.path.exists(self.psych_file):
            with open(self.psych_file, "w") as f:
                json.dump({}, f)

        # 2. Initialize ChromaDB for Outreach History
        try:
            self.chroma_client = chromadb.PersistentClient(path=self.chroma_dir)
            
            # Use default embedding function (all-MiniLM-L6-v2) which is lightweight and local
            self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
            
            self.outreach_collection = self.chroma_client.get_or_create_collection(
                name="outreach_history",
                embedding_function=self.embedding_fn
            )
            logger.info(f"🧠 KB: Connected to ChromaDB at {self.chroma_dir}")
        except Exception as e:
            logger.error(f"❌ KB: Failed to initialize ChromaDB: {e}")
            self.outreach_collection = None

    def _load_json(self, filepath: str) -> Any:
        try:
            with open(filepath, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}

    def _save_json(self, filepath: str, data: Any):
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    def save_prospect(self, prospect: ProspectProfile):
        """Saves or updates a prospect profile in JSON."""
        # Generic "User" profile is often a placeholder, but we save it if it has data
        if not prospect.name: 
            return
            
        data = self._load_json(self.prospects_file)
        # key by name + company to avoid duplicates
        key = f"{prospect.name}_{prospect.company}"
        data[key] = prospect.model_dump()
        self._save_json(self.prospects_file, data)
        logger.info(f"💾 KB: Saved prospect {prospect.name}")

    def get_prospect(self, name: str, company: str) -> Optional[ProspectProfile]:
        """Retrieves a prospect profile from JSON."""
        data = self._load_json(self.prospects_file)
        # Try exact match first
        key = f"{name}_{company}"
        if key in data:
            return ProspectProfile(**data[key])
            
        # Try loose match on name only
        for k, v in data.items():
            if name in k:
                return ProspectProfile(**v)
                
        return None

    def save_psych_profile(self, name: str, company: str, profile: Any):
        """Saves a psych profile to JSON."""
        # reusing prospects file or creating a new one? 
        # Let's keep it simple and store it within the prospect entry in prospects.json
        data = self._load_json(self.prospects_file)
        key = f"{name}_{company}"
        
        if key not in data:
            logger.warning(f"⚠️ KB: Cannot save psych profile for unknown prospect {name}")
            return

        # Assuming the prospect data is a dict (from model_dump), adding a new field 'psych'
        # We need to make sure we don't break the ProspectProfile schema validation on load.
        # Ideally, we should have a separate file or a more flexible schema.
        # For this iteration, let's use a separate file 'psych.json' to avoid schema conflicts.
        
        psych_file = os.path.join(self.storage_dir, "psych.json")
        psych_data = self._load_json(psych_file)
        
        # We store the dump
        psych_data[key] = profile.model_dump()
        self._save_json(psych_file, psych_data)
        logger.info(f"🧠 KB: Saved psych profile for {name}")

    def get_psych_profile(self, name: str, company: str) -> Optional[Any]:
        """Retrieves a psych profile."""
        psych_file = os.path.join(self.storage_dir, "psych.json")
        # Ensure file exists
        if not os.path.exists(psych_file):
            return None
            
        data = self._load_json(psych_file)
        key = f"{name}_{company}"
        
        if key in data:
            # We return the dict, the caller (node) will instantiate the Pydantic model
            return data[key]
        return None

    def save_outreach(self, prospect: ProspectProfile, strategy: StrategyBrief, content: str):
        """Saves an outreach example to ChromaDB."""
        if not content or not self.outreach_collection:
            return
            
        try:
            # Metadata for filtering
            metadata = {
                "prospect_name": prospect.name,
                "role": prospect.role,
                "company": prospect.company,
                "channel": strategy.target_channel,
                "goal": strategy.goal,
                "industry": prospect.industry or "Unknown"
            }
            
            # ID generation
            import uuid
            doc_id = str(uuid.uuid4())
            
            # Add to Chroma
            self.outreach_collection.add(
                documents=[content],
                metadatas=[metadata],
                ids=[doc_id]
            )
            logger.info(f"💾 KB: Vectorized outreach for {prospect.name} via {strategy.target_channel}")
            
        except Exception as e:
            logger.error(f"❌ KB: Failed to save to Chroma: {e}")

    def get_similar_outreach(self, query_text: str, role: str = None, limit: int = 3) -> List[Dict]:
        """
        Retrieves similar past outreach examples using semantic search.
        Args:
            query_text: The bio or context to match against (Semantic Search).
            role: Optional filter by role (Metadata Filter).
        """
        if not self.outreach_collection:
            return []
            
        try:
            # Build filters
            where_clause = {}
            if role:
                 # Simple substring match isn't directly supported in Chroma 'where', 
                 # closely matching roles logic would be complex. 
                 # For now, we rely on semantic search of the content itself.
                 pass

            results = self.outreach_collection.query(
                query_texts=[query_text],
                n_results=limit,
                # where=where_clause if where_clause else None 
            )
            
            # Chroma returns lists of lists
            documents = results['documents'][0]
            metadatas = results['metadatas'][0]
            
            structured_results = []
            for doc, meta in zip(documents, metadatas):
                entry = meta.copy()
                entry['content'] = doc
                structured_results.append(entry)
                
            return structured_results
            
        except Exception as e:
            logger.error(f"❌ KB: Semantic search failed: {e}")
            return []
