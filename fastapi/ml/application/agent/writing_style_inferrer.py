"""Writing style inference utilities for extracting style rules and examples from documents."""
import os
from agent_style_transfer.llm_provider_setup import get_instructor_client
from agent_style_transfer.schemas import Document, FewShotExample, StyleRules


def infer_style_rules(
    documents: list[Document], provider: str = "ollama", model: str = None
) -> list[str]:
    """
    Infer style rules from a list of documents using LLM analysis with structured output.

    Args:
        documents: List of reference documents to analyze
        provider: LLM provider (openai, anthropic, google_genai, ollama)
        model: Model name (optional, uses provider default)

    Returns:
        List of style rules inferred from the documents
    """
    if not documents:
        return []

    # Get Instructor client
    client, model_name = get_instructor_client(provider, model, temperature=0.3)

    # Combine document content for analysis
    combined_content = "\n\n".join(
        [
            f"Title: {doc.title}\nContent: {doc.content[:500]}..."
            for doc in documents
            if doc.title and doc.content
        ]
    )

    if not combined_content:
        return []

    # Create a prompt to analyze writing style patterns
    # Instructor handles the JSON structure enforcement
    prompt = f"""
    Analyze the following documents and extract 3-5 specific, actionable writing style rules.
    Focus on tone, structure, vocabulary, and sentence length.

    Documents:
    {combined_content}
    
    Ensure the rules are concise and directly actionable.
    """

    try:
        # Structured output call
        resp = client.create(
            model=model_name,
            response_model=StyleRules,
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_retries=3,
        )
        return resp.rules
    except Exception as e:
        # Fallback or error logging
        print(f"Error inferring style rules: {e}")
        return []


def infer_few_shot_examples(
    documents: list[Document], provider: str = "ollama", model: str = None
) -> list[FewShotExample]:
    """
    Infer few-shot examples from a list of documents using LLM analysis with structured output.

    Args:
        documents: List of reference documents to analyze
        provider: LLM provider (openai, anthropic, google_genai, ollama)
        model: Model name (optional, uses provider default)

    Returns:
        List of few-shot examples inferred from the documents
    """
    if not documents:
        return []

    # Get Instructor client
    client, model_name = get_instructor_client(provider, model, temperature=0.3)

    examples = []

    # Analyze each document to create meaningful examples
    for doc in documents:
        if doc.title and doc.content:
            prompt = f"""
            Analyze this document and create a SINGLE few-shot example that demonstrates its writing style.

            Document:
            Title: {doc.title}
            Content: {doc.content[:500]}...
            
            Create a simple input-output pair.
            Input: A generic topic or question.
            Output: A response written in the EXACT same style as the document (vocabulary, tone, structure).
            """

            try:
                # Structured output call
                example = client.create(
                    model=model_name,
                    response_model=FewShotExample,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    max_retries=3,
                )
                examples.append(example)
            except Exception as e:
                print(f"Error inferring example: {e}")
                continue

    return examples
