# AI Agent With Shell & RAG

An autonomous, interactive **AI Security Chatbot** with **direct shell execution**, **dynamic model selection**, and a **local RAG knowledge base** with drag-and-drop file ingestion (PDFs, source code, network logs, security reports, configs).

Built on top of **FastAPI**, **LangChain**, **NVIDIA NIM**, and **React (Vite + TypeScript + Tailwind CSS)**.

---

## 🌟 Key Features

### 1. 🤖 Model Selection on the Fly
- **Preconfigured Models**: Switch between top-tier models with a single click in the header:
  - `nvidia/nemotron-3.5-lightning-30b-a3b`
  - `meta/llama-3.3-70b-instruct`
  - `mistralai/mistral-large-2-instruct`
  - `deepseek-ai/deepseek-r1`
  - `meta/llama-3.1-8b-instruct`
  - `nvidia/llama-3.1-nemotron-70b-instruct`
- **Custom Model Support**: Enter any model identifier from NVIDIA NIM or OpenAI-compatible endpoints.
- **Configurable Hyperparameters**: Adjust Temperature, RAG minimum score, and embedding models in Settings.

### 2. ⚡ Direct Shell Execution
- **Agent Tool Execution (`execute_shell_command`)**: When the assistant needs to audit network status, run diagnostics, or inspect files, it runs shell commands directly and displays the results in a sleek **Terminal Card** showing exit codes, duration, and formatted stdout/stderr.
- **Interactive Shell Console**: Open the built-in terminal runner by clicking the **Shell** button in the header to execute arbitrary host commands manually alongside the agent.

### 3. 📂 Local RAG Knowledge Base & File Uploads
- **Multi-file Drag & Drop**: Upload PDFs, Python/JS/C++ code, Bash/PowerShell scripts, logs, CSVs, JSON, YAML, and Markdown files.
- **Directory Path Indexing**: Index local folders directly by entering their path (e.g. `C:\logs` or `./docs`).
- **Vector Cosine Similarity**: Embeds documents using `nvidia/nemotron-3-embed-1b` and persists vectors locally with `numpy`.
- **Automatic Retrieval**: Seamlessly injects relevant excerpts into chat queries with confidence scores and citations.
- **RAG Toggle**: Toggle retrieval injection ON or OFF anytime with the header pill.
- **Debug Similarity Search**: Test vector searches directly in the sidebar to inspect matching chunks and scores.

### 4. 💬 Modern Chat Experience
- **Real-Time Streaming**: Agent thoughts, tool invocations, and responses stream live via Server-Sent Events (SSE).
- **Rich Markdown & Syntax Highlighting**: Clean code blocks with copy-to-clipboard buttons.
- **Slash Commands Autocomplete**: Type `/` to access commands:
  - `/upload <path>` — Index local folder or file.
  - `/docs` — List all indexed sources.
  - `/drop [source]` — Remove a source or clear knowledge base.
  - `/search <query>` — Vector similarity search debugger.
  - `/rag on|off` — Toggle automatic retrieval.
  - `/reset` — Clear conversation history.
  - `/help` — View available commands.

---

## 🚀 Quickstart

### 1. Requirements
- **Python 3.10+** (Python 3.14 compatible)
- **Node.js 18+** & npm
- **NVIDIA NIM API Key** (Get free credits at [build.nvidia.com](https://build.nvidia.com))

### 2. Start Application (One-Click)

#### On Windows:
Double click `run.bat` or run in PowerShell:
```powershell
.\run.ps1
```

#### Or Run Manually:

**Terminal 1 — Backend:**
```powershell
cd backend
python -m pip install -r requirements.txt
python app.py
```
*Backend runs on `http://127.0.0.1:8000` (API documentation at `/docs`).*

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## ⚙️ Configuration & API Key

You can configure your `NVIDIA_API_KEY` in two ways:
1. **Directly in the Web UI**: Click the ⚙️ Settings icon in the top right, paste your key, and click Save.
2. **Environment Variable**: Set `NVIDIA_API_KEY=nvapi-...` in your terminal or create a `.env` file in the root.

---

## 📁 Project Structure

```
sec-agent/
├── backend/
│   ├── app.py              # FastAPI server (chat streaming, RAG, uploads, shell)
│   ├── agent.py            # LangChain agent loop with SSE events & tool calling
│   ├── kb.py               # Vector store KnowledgeBase & Embedder (numpy persistence)
│   ├── tools.py            # Shell execution & knowledge base search tools
│   ├── config.py           # Preconfigured models, default directories, system prompt
│   ├── requirements.txt    # Python dependencies
│   └── test_backend.py     # Automated endpoint tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/       # Message list, interactive terminal tool cards, input bar
│   │   │   ├── Header.tsx  # Model selector, RAG toggle, shell trigger, settings
│   │   │   ├── Sidebar.tsx # File dropzone, local path indexer, document manager
│   │   │   ├── SettingsModal.tsx # API key & model settings modal
│   │   │   └── ShellConsole/     # Dedicated interactive terminal console modal
│   │   ├── services/api.ts # API client for SSE streaming, files, and shell
│   │   ├── types.ts        # TypeScript definitions
│   │   ├── App.tsx         # Main application coordinator
│   │   └── index.css       # Dark cyber-security styling with Tailwind CSS
│   ├── package.json
│   └── vite.config.ts
├── run.bat                 # One-click Windows CMD runner
├── run.ps1                 # One-click PowerShell runner
├── .env.example
└── README.md
```
