from ml.application.agent.graph import create_agent_graph

from ml.settings import settings
# Create the graph instance
# We use a default model, but this can be overridden by config if needed in a real deployment
graph = create_agent_graph(model_name=settings.LLM_MODEL)
