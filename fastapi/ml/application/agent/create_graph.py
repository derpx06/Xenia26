# generate_graph.py
import sys
import os

# Add project root to sys.path to allow running as script
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../../.."))  # 3 levels up to reach fastapi/
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from ml.application.agent.graph import create_agent_graph

from ml.application.agent.graph import create_agent_graph

def save_graph_image():
    print("Compiling graph...")
    app = create_agent_graph()
    
    print("Generating image...")
    png_bytes = app.get_graph().draw_mermaid_png()
    
    filename = "agent_architecture.png"
    with open(filename, "wb") as f:
        f.write(png_bytes)
    
    print(f"Graph saved to {filename}")

if __name__ == "__main__":
    save_graph_image()