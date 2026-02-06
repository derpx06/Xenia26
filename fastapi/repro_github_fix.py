
import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock dependencies before importing the module under test
sys.modules['ml.domain.documents'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['loguru'] = MagicMock()
sys.modules['chromedriver_autoinstaller'] = MagicMock()
sys.modules['selenium'] = MagicMock()
sys.modules['selenium.webdriver'] = MagicMock()
sys.modules['selenium.webdriver.chrome.options'] = MagicMock()
sys.modules['selenium.webdriver.chrome.service'] = MagicMock()
sys.modules['selenium.webdriver.common'] = MagicMock()
sys.modules['selenium.webdriver.common.by'] = MagicMock()
sys.modules['selenium.webdriver.support'] = MagicMock()
sys.modules['selenium.webdriver.support.ui'] = MagicMock()
sys.modules['selenium.webdriver.support.expected_conditions'] = MagicMock()
sys.modules['selenium.common'] = MagicMock()
sys.modules['selenium.common.exceptions'] = MagicMock()
sys.modules['pymongo'] = MagicMock()
sys.modules['pymongo.errors'] = MagicMock()
sys.modules['qdrant_client'] = MagicMock()
sys.modules['qdrant_client.http'] = MagicMock()
sys.modules['qdrant_client.http.exceptions'] = MagicMock()
sys.modules['qdrant_client.http.models'] = MagicMock()
sys.modules['qdrant_client.models'] = MagicMock()
sys.modules['unstructured'] = MagicMock()
sys.modules['unstructured.partition'] = MagicMock()
sys.modules['unstructured.partition.html'] = MagicMock()
mock_st = MagicMock()
sys.modules['sentence_transformers'] = mock_st
sys.modules['sentence_transformers.SentenceTransformer'] = MagicMock()
sys.modules['sentence_transformers.cross_encoder'] = MagicMock()
sys.modules['transformers'] = MagicMock()
mock_numpy = MagicMock()
mock_numpy.__version__ = "1.24.3"
sys.modules['numpy'] = mock_numpy
sys.modules['numpy.typing'] = MagicMock()
# Mock package structure for langchain_community
mock_langchain = MagicMock()
sys.modules['langchain_community'] = mock_langchain
sys.modules['langchain_community.document_loaders'] = MagicMock()
sys.modules['langchain_community.document_transformers'] = MagicMock()
sys.modules['langchain_community.document_transformers.html2text'] = MagicMock()

# Import the module to test
from ml.application.crawlers.github import GithubProfileCrawler

class TestGithubCrawler(unittest.TestCase):
    def test_existing_profile_returns_content(self):
        # Setup mocks
        mock_existing_doc = MagicMock()
        mock_existing_doc.content = {"profile": "cached_data"}
        
        # Configure the crawler's model.find to return our mock document
        GithubProfileCrawler.model.find.return_value = mock_existing_doc
        
        # Initialize crawler
        crawler = GithubProfileCrawler()
        
        # Run extract
        result = crawler.extract("testuser")
        
        # Verify result
        print(f"Result returned: {result}")
        self.assertEqual(result, {"profile": "cached_data"})
        print("✅ SUCCESS: Cached content was returned correctly")

if __name__ == '__main__':
    unittest.main()
