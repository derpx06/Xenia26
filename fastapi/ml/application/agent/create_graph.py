# generate_graph.py
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