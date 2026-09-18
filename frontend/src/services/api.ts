import type { AppSettings, KbSource, ModelInfo, EmbedModelInfo, RagHit, ShellExecMeta } from '../types';

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchModels(): Promise<{
  chat_models: ModelInfo[];
  embed_models: EmbedModelInfo[];
  default_chat_model: string;
  default_embed_model: string;
}> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to load models list');
  return res.json();
}

export async function uploadFiles(
  files: File[],
  apiKey?: string,
  embedModel?: string
): Promise<{
  success: boolean;
  indexed: { name: string; chunks: number }[];
  skipped: { name: string; reason: string }[];
  total_chunks: number;
  total_sources: number;
}> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));

  const params = new URLSearchParams();
  if (apiKey) params.append('api_key', apiKey);
  if (embedModel) params.append('embed_model', embedModel);

  const res = await fetch(`${API_BASE}/upload?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function indexLocalPath(
  path: string,
  apiKey?: string,
  embedModel?: string
) {
  const res = await fetch(`${API_BASE}/index-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, api_key: apiKey, embed_model: embedModel }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Index path failed' }));
    throw new Error(err.detail || 'Index path failed');
  }
  return res.json();
}

export async function fetchSources(): Promise<{
  sources: KbSource[];
  total_chunks: number;
}> {
  const res = await fetch(`${API_BASE}/kb/sources`);
  if (!res.ok) throw new Error('Failed to load KB sources');
  return res.json();
}

export async function dropSource(source?: string) {
  const res = await fetch(`${API_BASE}/kb/drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) throw new Error('Failed to drop source');
  return res.json();
}

export async function clearKb() {
  const res = await fetch(`${API_BASE}/kb/clear`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to clear knowledge base');
  return res.json();
}

export async function searchKb(
  query: string,
  apiKey?: string,
  embedModel?: string,
  k: number = 5
): Promise<{ hits: any[]; count: number }> {
  const res = await fetch(`${API_BASE}/kb/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, api_key: apiKey, embed_model: embedModel, k }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Search failed' }));
    throw new Error(err.detail || 'Search failed');
  }
  return res.json();
}

export async function execShellCommand(
  command: string,
  timeout: number = 60
): Promise<ShellExecMeta> {
  const res = await fetch(`${API_BASE}/shell/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, timeout }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Shell exec failed' }));
    throw new Error(err.detail || 'Shell exec failed');
  }
  return res.json();
}

export async function fetchShellHistory(): Promise<{ history: ShellExecMeta[] }> {
  const res = await fetch(`${API_BASE}/shell/history`);
  if (!res.ok) throw new Error('Failed to load shell history');
  return res.json();
}

export interface StreamCallbacks {
  onRagRetrieval?: (hits: RagHit[]) => void;
  onThinking?: () => void;
  onToolCall?: (call: { id: string; name: string; args: Record<string, any> }) => void;
  onToolResult?: (res: { id: string; name: string; output: string; meta?: ShellExecMeta }) => void;
  onContent?: (content: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export async function streamChat(
  message: string,
  history: Array<{ role: string; content: string; tool_calls?: any[] }>,
  settings: AppSettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) {
  const payload = {
    message,
    history,
    model: settings.chatModel,
    embed_model: settings.embedModel,
    rag_enabled: settings.ragEnabled,
    rag_min_score: settings.ragMinScore,
    temperature: settings.temperature,
    api_key: settings.apiKey || undefined,
    base_url: settings.baseUrl || undefined,
  };

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Chat request failed' }));
    callbacks.onError?.(err.detail || `Server error: ${response.statusText}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.('Readable stream not supported');
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'rag_retrieval') {
              callbacks.onRagRetrieval?.(event.hits || []);
            } else if (event.type === 'thinking') {
              callbacks.onThinking?.();
            } else if (event.type === 'tool_call') {
              callbacks.onToolCall?.(event);
            } else if (event.type === 'tool_result') {
              callbacks.onToolResult?.(event);
            } else if (event.type === 'content') {
              callbacks.onContent?.(event.content);
            } else if (event.type === 'error') {
              callbacks.onError?.(event.message);
            } else if (event.type === 'done') {
              callbacks.onDone?.();
            }
          } catch (e) {
            console.error('Failed to parse SSE line:', jsonStr, e);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('Stream aborted by user');
    } else {
      callbacks.onError?.(err.message || 'Stream processing failed');
    }
  } finally {
    callbacks.onDone?.();
  }
}
