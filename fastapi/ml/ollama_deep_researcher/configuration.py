import os
from pydantic import BaseModel, Field
from typing import Any, Optional, Literal

from langchain_core.runnables import RunnableConfig


class Configuration(BaseModel):
    """The configurable fields for the research assistant."""

    max_web_research_loops: int = Field(
        default=3,
        title="Research Depth",
        description="Number of research iterations to perform",
    )
    local_llm: str = Field(
        default="qwen2.5:7b",
        title="LLM Model Name",
        description="Name of the LLM model to use",
    )
    search_api: Literal["perplexity", "tavily", "duckduckgo", "searxng"] = Field(
        default="tavily", title="Search API", description="Web search API to use"
    )
    fetch_full_page: bool = Field(
        default=True,
        title="Fetch Full Page",
        description="Include the full page content in the search results",
    )
    ollama_base_url: str = Field(
        default="http://localhost:11434/",
        title="Ollama Base URL",
        description="Base URL for Ollama API",
    )
    strip_thinking_tokens: bool = Field(
        default=True,
        title="Strip Thinking Tokens",
        description="Whether to strip <think> tokens from model responses",
    )
    use_tool_calling: bool = Field(
        default=False,
        title="Use Tool Calling",
        description="Use tool calling instead of JSON mode for structured output",
    )
    web_results_per_topic: int = Field(
        default=4,
        title="Web Results Per Topic",
        description="How many web search hits to keep per research sub-topic",
    )
    wiki_results_per_topic: int = Field(
        default=2,
        title="Wikipedia Results Per Topic",
        description="How many Wikipedia page summaries to include per sub-topic",
    )
    image_results_per_topic: int = Field(
        default=3,
        title="Image Results Per Topic",
        description="How many image candidates to keep per sub-topic",
    )
    include_images_in_research: bool = Field(
        default=True,
        title="Include Images In Research",
        description="Collect image candidates while researching with Tavily",
    )
    include_images_in_article: bool = Field(
        default=False,
        title="Include Images In Article",
        description="Allow the writer to include relevant markdown images in the draft",
    )
    max_images_per_article: int = Field(
        default=2,
        title="Max Images Per Article",
        description="Upper bound for markdown images inserted into final article",
    )
    max_research_bible_chars: int = Field(
        default=9000,
        title="Max Research Bible Chars",
        description="Maximum number of characters passed to writer from synthesized research",
    )
    research_task_timeout_seconds: int = Field(
        default=120,
        title="Research Task Timeout Seconds",
        description="Timeout budget for each sub-topic research task batch",
    )
    llm_timeout_seconds: int = Field(
        default=360,
        title="LLM Timeout Seconds",
        description="Timeout budget for each LLM node call",
    )
    orchestrator_timeout_seconds: int = Field(
        default=120,
        title="Orchestrator Timeout Seconds",
        description="Timeout budget for orchestrator planning call",
    )
    planner_timeout_seconds: int = Field(
        default=120,
        title="Planner Timeout Seconds",
        description="Timeout budget for planner outline call",
    )
    writer_section_timeout_seconds: int = Field(
        default=400,
        title="Writer Section Timeout Seconds",
        description="Timeout budget for each writer section generation call",
    )
    editor_timeout_seconds: int = Field(
        default=180,
        title="Editor Timeout Seconds",
        description="Timeout budget for final editor/humanizer calls",
    )
    max_parallel_subtopics: int = Field(
        default=4,
        title="Max Parallel Subtopics",
        description="Maximum number of research workers to fan out in parallel",
    )
    enable_search_cache: bool = Field(
        default=True,
        title="Enable Search Cache",
        description="Cache research search results for repeated queries",
    )
    search_cache_ttl_seconds: int = Field(
        default=900,
        title="Search Cache TTL Seconds",
        description="TTL for cached search results",
    )

    @classmethod
    def from_runnable_config(
        cls, config: Optional[RunnableConfig] = None
    ) -> "Configuration":
        """Create a Configuration instance from a RunnableConfig."""
        configurable = (
            config["configurable"] if config and "configurable" in config else {}
        )

        # Get raw values from environment or config
        raw_values: dict[str, Any] = {
            name: os.environ.get(name.upper(), configurable.get(name))
            for name in cls.model_fields.keys()
        }

        # Filter out None values
        values = {k: v for k, v in raw_values.items() if v is not None}

        return cls(**values)
