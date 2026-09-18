export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  provider?: string;
}

export interface EmbedModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface RagHit {
  source: string;
  filename: string;
  chunk: number;
  score: number;
  snippet: string;
}

export interface ShellExecMeta {
  id?: string;
  command: string;
  returncode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timestamp: string;
  status: 'success' | 'error' | 'timeout';
}

export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResultItem {
  id: string;
  name: string;
  output: string;
  meta?: ShellExecMeta;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isThinking?: boolean;
  ragHits?: RagHit[];
  toolCalls?: ToolCallItem[];
  toolResults?: ToolResultItem[];
  error?: string;
}

export interface KbSource {
  source: string;
  filename: string;
  chunks: number;
  approxChars: number;
}

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embedModel: string;
  ragEnabled: boolean;
  ragMinScore: number;
  temperature: number;
}
