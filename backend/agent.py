from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI

from config import (
    DEFAULT_CHAT_MODEL,
    NVIDIA_BASE_URL,
    RAG_MIN_SCORE,
    RAG_TOP_K,
    SYSTEM_PROMPT,
)
from kb import KnowledgeBase
from tools import execute_shell_command, make_search_tool, run_shell


def build_message_history(history: List[Dict[str, Any]]) -> List[BaseMessage]:
    """Convert JSON conversation history into LangChain messages."""
    langchain_msgs: List[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]

    for m in history:
        role = m.get("role")
        content = m.get("content", "")
        if role == "user":
            langchain_msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            tool_calls = m.get("tool_calls")
            if tool_calls:
                langchain_msgs.append(AIMessage(content=content or "", tool_calls=tool_calls))
            else:
                langchain_msgs.append(AIMessage(content=content or ""))
        elif role == "tool":
            langchain_msgs.append(ToolMessage(
                content=content or "",
                tool_call_id=m.get("tool_call_id", "default_tool_id")
            ))

    return langchain_msgs


async def run_agent_stream(
    user_input: str,
    history: List[Dict[str, Any]],
    kb: KnowledgeBase,
    chat_model: str = DEFAULT_CHAT_MODEL,
    api_key: Optional[str] = None,
    base_url: str = NVIDIA_BASE_URL,
    rag_enabled: bool = True,
    rag_min_score: float = RAG_MIN_SCORE,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    """
    Executes the agent loop with streaming SSE output:
    Yields JSON events with types:
    - 'rag_retrieval': context injected from KB
    - 'thinking': model thinking state
    - 'tool_call': tool invoked with arguments
    - 'tool_result': tool completed with stdout/stderr/hits
    - 'content': assistant response text
    - 'done': complete
    - 'error': error message
    """
    key = api_key or os.environ.get("NVIDIA_API_KEY", "")
    if not key:
        yield json.dumps({
            "type": "error",
            "message": "NVIDIA_API_KEY is not configured. Please enter your API key in Settings or set the environment variable."
        })
        return

    # Build tools
    search_tool = make_search_tool(kb)
    tools = [execute_shell_command, search_tool]
    tools_map = {t.name: t for t in tools}

    # Setup Chat LLM
    try:
        llm = ChatOpenAI(
            base_url=base_url,
            api_key=key,
            model=chat_model,
            temperature=temperature,
            max_tokens=16384,
            seed=42,
            extra_body={"chat_template_kwargs": {"thinking": False}},
        ).bind_tools(tools)
    except Exception as e:
        yield json.dumps({
            "type": "error",
            "message": f"Failed to initialize Chat LLM with model '{chat_model}': {str(e)}"
        })
        return

    # 1. Automatic RAG retrieval
    outgoing_text = user_input
    rag_hits_info = []

    if rag_enabled and len(kb):
        try:
            hits = kb.search(user_input, k=RAG_TOP_K)
            valid_hits = [h for h in hits if h["score"] >= rag_min_score]
            if valid_hits:
                rag_hits_info = [
                    {
                        "source": h["source"],
                        "filename": Path(h["source"]).name,
                        "chunk": h["chunk"],
                        "score": round(h["score"], 3),
                        "snippet": h["text"][:300]
                    }
                    for h in valid_hits
                ]

                context = "\n\n".join(
                    f"<document source=\"{h['source']}\" chunk=\"{h['chunk']}\">\n"
                    f"{h['text']}\n</document>"
                    for h in valid_hits
                )
                outgoing_text = (
                    "The following excerpts were retrieved from the user's uploaded "
                    "knowledge base. Use them if they are relevant; ignore them "
                    "otherwise.\n\n"
                    f"<knowledge_base>\n{context}\n</knowledge_base>\n\n"
                    f"User message: {user_input}"
                )

                yield json.dumps({
                    "type": "rag_retrieval",
                    "hits": rag_hits_info
                })
        except Exception as exc:
            yield json.dumps({
                "type": "rag_retrieval_error",
                "message": f"Knowledge base search warning: {str(exc)}"
            })

    # Prepare message chain
    messages = build_message_history(history)
    messages.append(HumanMessage(content=outgoing_text))

    max_tool_turns = 12
    turns = 0

    while turns < max_tool_turns:
        turns += 1
        yield json.dumps({"type": "thinking"})

        try:
            response = await llm.ainvoke(messages)
        except Exception as e:
            yield json.dumps({
                "type": "error",
                "message": f"Model inference error: {str(e)}"
            })
            return

        messages.append(response)

        if response.tool_calls:
            for call in response.tool_calls:
                call_id = call.get("id", f"call-{int(asyncio.get_event_loop().time()*1000)}")
                tool_name = call.get("name")
                args = call.get("args", {})

                yield json.dumps({
                    "type": "tool_call",
                    "id": call_id,
                    "name": tool_name,
                    "args": args
                })

                # Execute tool
                tool_obj = tools_map.get(tool_name)
                output_str = ""
                extra_meta = {}

                if tool_obj is None:
                    output_str = f"Error: Unknown tool '{tool_name}'"
                elif tool_name == "execute_shell_command":
                    cmd_str = args.get("command", "")
                    run_meta = run_shell(cmd_str)
                    extra_meta = run_meta
                    if run_meta["returncode"] == 0:
                        output_str = f"Command succeeded (rc=0).\nOutput:\n{run_meta['stdout'] or '(no output)'}"
                    else:
                        output_str = f"Command failed (rc={run_meta['returncode']}).\nError:\n{run_meta['stderr'] or run_meta['stdout']}"
                else:
                    try:
                        res = await tool_obj.ainvoke(args)
                        output_str = str(res)
                    except Exception as ex:
                        output_str = f"Tool execution failed: {str(ex)}"

                output_str_capped = output_str[:12000]

                yield json.dumps({
                    "type": "tool_result",
                    "id": call_id,
                    "name": tool_name,
                    "output": output_str_capped,
                    "meta": extra_meta
                })

                messages.append(ToolMessage(
                    content=output_str_capped,
                    tool_call_id=call_id
                ))
        else:
            # Final text response
            final_content = response.content or ""
            yield json.dumps({
                "type": "content",
                "content": final_content
            })
            break

    yield json.dumps({
        "type": "done",
        "turns": turns
    })
