from __future__ import annotations

import os
from pathlib import Path

NVIDIA_BASE_URL = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
DEFAULT_CHAT_MODEL = os.environ.get("DEFAULT_CHAT_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
DEFAULT_EMBED_MODEL = os.environ.get("DEFAULT_EMBED_MODEL", "nvidia/nemotron-3-embed-1b")
DEFAULT_KB_DIR = Path.home() / ".ai_security_agent" / "kb"

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200
EMBED_BATCH = 32
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10MB
RAG_TOP_K = 5
RAG_MIN_SCORE = 0.20

AVAILABLE_CHAT_MODELS = [
    {
        "id": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "name": "NVIDIA Nemotron-3.5-Lightning 30B",
        "description": "Fast & high performance agentic model by NVIDIA",
        "provider": "NVIDIA"
    },
    {
        "id": "meta/llama-3.3-70b-instruct",
        "name": "Meta Llama 3.3 70B Instruct",
        "description": "Highly capable general and security reasoning model",
        "provider": "Meta"
    },
    {
        "id": "mistralai/mistral-large-2-instruct",
        "name": "Mistral Large 2 Instruct",
        "description": "Top-tier multilingual code and reasoning model",
        "provider": "Mistral"
    },
    {
        "id": "deepseek-ai/deepseek-r1",
        "name": "DeepSeek R1",
        "description": "Deep reasoning and chain-of-thought model",
        "provider": "DeepSeek"
    },
    {
        "id": "meta/llama-3.1-8b-instruct",
        "name": "Meta Llama 3.1 8B Instruct",
        "description": "Ultra lightweight and low latency",
        "provider": "Meta"
    },
    {
        "id": "nvidia/llama-3.1-nemotron-70b-instruct",
        "name": "NVIDIA Llama 3.1 Nemotron 70B",
        "description": "Optimized by NVIDIA for high accuracy responses",
        "provider": "NVIDIA"
    }
]

AVAILABLE_EMBED_MODELS = [
    {
        "id": "nvidia/nemotron-3-embed-1b",
        "name": "NVIDIA Nemotron-3 Embed 1B",
        "description": "Standard high performance passage and query embeddings"
    },
    {
        "id": "baai/bge-m3",
        "name": "BGE-M3 Multilingual",
        "description": "Dense multilingual embedding model"
    }
]

SYSTEM_PROMPT = (
    "You are an expert AI Security Assistant with direct shell execution capabilities "
    "and a local retrieval-augmented knowledge base (RAG) built from files uploaded by the user.\n\n"
    "Core Capabilities & Guidelines:\n"
    "1. Shell Execution: You have access to the 'execute_shell_command' tool. Use it whenever "
    "necessary to inspect network status, run security diagnostics (e.g. nmap, ping, netstat, curl, whoami), "
    "examine file systems, read logs, check running processes, or execute security tools.\n"
    "2. Knowledge Base: You have access to 'search_knowledge_base'. Use it whenever the user "
    "inquires about uploaded documents, reports, logs, code, configs, or specific project files.\n"
    "3. Grounding & Citations: Whenever you utilize information retrieved from the knowledge base, "
    "explicitly cite the source file name and chunk.\n"
    "4. Format: Respond with clear, practical, and well-structured Markdown. Code and command outputs "
    "should be nicely formatted.\n"
    "5. Safety & Transparency: If a shell command is potentially destructive, mention what it does clearly."
)
