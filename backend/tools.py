from __future__ import annotations

import os
import subprocess
import time
from typing import Any, Callable, Dict, List, Optional
from langchain_core.tools import tool

# Track shell execution history for the UI Shell Console
shell_history: List[Dict[str, Any]] = []


def run_shell(command: str, timeout: int = 60) -> Dict[str, Any]:
    """Execute a shell command, measure duration, and record in history."""
    start_time = time.time()
    try:
        # Use powershell or cmd on Windows, or sh on Linux
        use_shell = True
        result = subprocess.run(
            command,
            shell=use_shell,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        duration = round(time.time() - start_time, 3)
        out = result.stdout.strip()
        err = result.stderr.strip()
        record = {
            "id": f"exec-{int(time.time() * 1000)}",
            "command": command,
            "returncode": result.returncode,
            "stdout": out,
            "stderr": err,
            "duration": duration,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "success" if result.returncode == 0 else "error"
        }
        shell_history.append(record)
        if len(shell_history) > 100:
            shell_history.pop(0)

        return record
    except subprocess.TimeoutExpired:
        duration = round(time.time() - start_time, 3)
        record = {
            "id": f"exec-{int(time.time() * 1000)}",
            "command": command,
            "returncode": -1,
            "stdout": "",
            "stderr": f"Error: Command timed out after {timeout} seconds.",
            "duration": duration,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "timeout"
        }
        shell_history.append(record)
        return record
    except Exception as e:
        duration = round(time.time() - start_time, 3)
        record = {
            "id": f"exec-{int(time.time() * 1000)}",
            "command": command,
            "returncode": -1,
            "stdout": "",
            "stderr": f"Exception executing command: {str(e)}",
            "duration": duration,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "error"
        }
        shell_history.append(record)
        return record


@tool
def execute_shell_command(command: str) -> str:
    """Execute a shell command on the local machine and return its output.
    
    Use this to run security tools, check network connections (ping, nmap, netstat, curl),
    inspect system files, list directories, check active processes, or run diagnostics.
    """
    res = run_shell(command)
    if res["returncode"] == 0:
        return f"Command succeeded (rc=0, duration={res['duration']}s).\nOutput:\n{res['stdout'] or '(no output)'}"
    else:
        err_msg = res["stderr"] or res["stdout"] or "Unknown error"
        return f"Command failed (rc={res['returncode']}, duration={res['duration']}s).\nError/Output:\n{err_msg}"


def make_search_tool(kb):
    """Build the search_knowledge_base LangChain tool with closure over kb."""
    @tool
    def search_knowledge_base(query: str) -> str:
        """Search the user's uploaded document knowledge base.

        Use this whenever the user asks about files they uploaded (documents,
        logs, source code, reports, security notes) or when you need project-specific
        context you do not already have.

        Args:
            query: A natural-language description of the information you need.
        """
        hits = kb.search(query, k=6)
        if not hits:
            return "No matching content found in the knowledge base."

        blocks = []
        for h in hits:
            blocks.append(
                f"[source: {h['source']} | chunk {h['chunk']} | "
                f"score {h['score']:.3f}]\n{h['text']}"
            )
        return "\n\n---\n\n".join(blocks)

    return search_knowledge_base
