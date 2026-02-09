"""
SARGE - Single-Model Adaptive Routing & Generation Engine
A lightweight cold outreach system using one local model with dynamic parameter control
"""
from .graph import create_sarge_graph, run_sarge
from .schemas import AgentState, RouterOutput, ProspectProfile, GeneratedContent
from .engine import get_engine

__all__ = [
    'create_sarge_graph',
    'run_sarge',
    'AgentState',
    'RouterOutput',
    'ProspectProfile',
    'GeneratedContent',
    'get_engine'
]
