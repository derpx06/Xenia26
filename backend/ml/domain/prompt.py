from ml.domain.base import VectorBaseDocument
from ml.domain.cleaned_documents import CleanedDocument
from ml.domain.types import DataCategory

class Prompt(VectorBaseDocument):
    template: str
    input_variables: dict
    content: str
    num_tokens: int | None = None

    class Config:
        category = DataCategory.PROMPT


class GenerateDatasetSamplesPrompt(Prompt):
    data_category: DataCategory
    document: CleanedDocument
