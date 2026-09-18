import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MessageList } from './components/Chat/MessageList';
import { InputArea } from './components/Chat/InputArea';
import { ShellModal } from './components/ShellConsole/ShellModal';
import { SettingsModal } from './components/SettingsModal';
import type {
  AppSettings,
  ChatMessage,
  KbSource,
  ModelInfo,
  EmbedModelInfo,
  RagHit
} from './types';
import {
  fetchHealth,
  fetchModels,
  fetchSources,
  streamChat,
  uploadFiles,
  indexLocalPath,
  dropSource,
  searchKb
} from './services/api';

const SETTINGS_STORAGE_KEY = 'sec_agent_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  chatModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  embedModel: 'nvidia/nemotron-3-embed-1b',
  ragEnabled: true,
  ragMinScore: 0.20,
  temperature: 0.7,
};

export function App() {
  // Settings state
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SETTINGS;
  });

  // Models & KB state
  const [availableChatModels, setAvailableChatModels] = useState<ModelInfo[]>([]);
  const [availableEmbedModels, setAvailableEmbedModels] = useState<EmbedModelInfo[]>([]);
  const [sources, setSources] = useState<KbSource[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modals & Panels
  const [isShellConsoleOpen, setIsShellConsoleOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save settings to localStorage
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
  };

  // Load backend models and knowledge base on mount
  const refreshSourcesList = async () => {
    try {
      const res = await fetchSources();
      setSources(res.sources);
      setTotalChunks(res.total_chunks);
    } catch (e) {
      console.error('Failed to load KB sources', e);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const health = await fetchHealth();
        if (health.current_embed_model) {
          setSettings((prev) => ({ ...prev, embedModel: prev.embedModel || health.current_embed_model }));
        }

        const modelsData = await fetchModels();
        setAvailableChatModels(modelsData.chat_models);
        setAvailableEmbedModels(modelsData.embed_models);

        if (!settings.chatModel) {
          setSettings((prev) => ({ ...prev, chatModel: modelsData.default_chat_model }));
        }
      } catch (e) {
        console.error('Initialization error:', e);
      }
      refreshSourcesList();
    };

    initApp();
  }, []);

  // Handle in-chat commands
  const handleSlashCommand = async (commandLine: string): Promise<boolean> => {
    const lowered = commandLine.trim().toLowerCase();

    if (lowered === '/reset') {
      setMessages([]);
      return true;
    }

    if (lowered === '/help') {
      const helpContent = `### Available Commands
- \`/upload <path>\` — Index a file or directory on the host into the knowledge base.
- \`/docs\` — List all indexed documents and chunk counts.
- \`/drop [filename]\` — Remove one document or clear entire knowledge base.
- \`/search <query>\` — Run direct similarity search against the knowledge base.
- \`/rag on\` or \`/rag off\` — Toggle automatic context injection.
- \`/reset\` — Clear chat conversation history.
- \`/help\` — Display this documentation.`;
      appendAssistantMessage(helpContent);
      return true;
    }

    if (lowered === '/docs') {
      if (sources.length === 0) {
        appendAssistantMessage('*Knowledge base is currently empty. Upload files or use `/upload <path>`.*');
      } else {
        const listText = sources
          .map((s) => `- **${s.filename}**: ${s.chunks} chunks (~${s.approxChars} chars)`)
          .join('\n');
        appendAssistantMessage(`### Indexed Knowledge Base Sources (${totalChunks} chunks)\n\n${listText}`);
      }
      return true;
    }

    if (lowered.startsWith('/rag')) {
      const arg = commandLine.slice(4).trim().toLowerCase();
      const nextRag = arg === 'on' || arg === 'true' || arg === '1';
      setSettings((prev) => ({ ...prev, ragEnabled: nextRag }));
      appendAssistantMessage(`Automatic RAG retrieval is now **${nextRag ? 'ON' : 'OFF'}**.`);
      return true;
    }

    if (lowered.startsWith('/drop')) {
      const arg = commandLine.slice(5).trim();
      try {
        const res = await dropSource(arg || undefined);
        refreshSourcesList();
        appendAssistantMessage(
          arg ? `Removed source \`${arg}\` (${res.removed_chunks} chunks).` : 'Cleared entire knowledge base.'
        );
      } catch (err: any) {
        appendAssistantMessage(`Error dropping source: ${err.message}`);
      }
      return true;
    }

    if (lowered.startsWith('/search')) {
      const query = commandLine.slice(7).trim();
      if (!query) {
        appendAssistantMessage('Usage: `/search <query>`');
        return true;
      }
      try {
        const res = await searchKb(query, settings.apiKey, settings.embedModel, 5);
        if (!res.hits || res.hits.length === 0) {
          appendAssistantMessage(`No similarity hits found for: *${query}*`);
        } else {
          const hitsFormatted = res.hits
            .map(
              (h: any) =>
                `**[${h.source.split(/[\\/]/).pop()} | chunk ${h.chunk} | score: ${(h.score).toFixed(3)}]**\n> ${h.text}`
            )
            .join('\n\n---\n\n');
          appendAssistantMessage(`### Knowledge Base Hits for "${query}"\n\n${hitsFormatted}`);
        }
      } catch (err: any) {
        appendAssistantMessage(`Search error: ${err.message}`);
      }
      return true;
    }

    if (lowered.startsWith('/upload')) {
      const path = commandLine.slice(7).trim().replace(/^["']|["']$/g, '');
      if (!path) {
        appendAssistantMessage('Usage: `/upload <path-to-file-or-dir>`');
        return true;
      }
      try {
        const res = await indexLocalPath(path, settings.apiKey, settings.embedModel);
        refreshSourcesList();
        if (res.success) {
          appendAssistantMessage(
            `Indexed **${res.indexed.length}** file(s) from \`${path}\` into **${res.total_chunks}** total chunks.`
          );
        } else {
          appendAssistantMessage(`Warning: ${res.message}`);
        }
      } catch (err: any) {
        appendAssistantMessage(`Upload error: ${err.message}`);
      }
      return true;
    }

    return false;
  };

  const appendAssistantMessage = (content: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Main chat sending flow
  const handleSendMessage = async (text: string) => {
    // Check if slash command
    if (text.startsWith('/')) {
      const handled = await handleSlashCommand(text);
      if (handled) return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `asst-${Date.now() + 1}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: nowTime,
    };

    const initialAsstMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: nowTime,
      isThinking: true,
      ragHits: [],
      toolCalls: [],
      toolResults: [],
    };

    const updatedHistory = [...messages, userMsg];
    setMessages([...updatedHistory, initialAsstMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Convert history for backend
    const apiHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls,
    }));

    await streamChat(
      text,
      apiHistory,
      settings,
      {
        onRagRetrieval: (hits: RagHit[]) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, ragHits: hits } : msg))
          );
        },
        onThinking: () => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isThinking: true } : msg))
          );
        },
        onToolCall: (call) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;
              const existingCalls = msg.toolCalls || [];
              return {
                ...msg,
                isThinking: true,
                toolCalls: [...existingCalls, call],
              };
            })
          );
        },
        onToolResult: (res) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;
              const existingResults = msg.toolResults || [];
              return {
                ...msg,
                toolResults: [...existingResults, res],
              };
            })
          );
        },
        onContent: (content: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content,
                    isThinking: false,
                  }
                : msg
            )
          );
        },
        onError: (errMessage: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    error: errMessage,
                    isThinking: false,
                  }
                : msg
            )
          );
          setIsStreaming(false);
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, isThinking: false } : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      },
      controller.signal
    );
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleUploadAttachment = async (files: FileList) => {
    try {
      const res = await uploadFiles(Array.from(files), settings.apiKey, settings.embedModel);
      refreshSourcesList();
      appendAssistantMessage(
        `Uploaded and indexed **${res.indexed.length}** file(s) into the knowledge base.`
      );
    } catch (e: any) {
      appendAssistantMessage(`Attachment error: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0f19] text-gray-100 overflow-hidden select-text">
      {/* Top Header */}
      <Header
        chatModel={settings.chatModel}
        onSelectModel={(modelId) => handleSaveSettings({ ...settings, chatModel: modelId })}
        availableModels={availableChatModels}
        ragEnabled={settings.ragEnabled}
        onToggleRag={() => handleSaveSettings({ ...settings, ragEnabled: !settings.ragEnabled })}
        kbChunksCount={totalChunks}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleShellConsole={() => setIsShellConsoleOpen(true)}
        isShellConsoleOpen={isShellConsoleOpen}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Collapsible Knowledge Base Sidebar */}
        <Sidebar
          sources={sources}
          totalChunks={totalChunks}
          apiKey={settings.apiKey}
          embedModel={settings.embedModel}
          onRefreshSources={refreshSourcesList}
          onInsertCommandPrompt={(cmd) => handleSendMessage(cmd)}
        />

        {/* Center Chat Area */}
        <main className="flex-1 flex flex-col h-full bg-[#0b0f19] overflow-hidden">
          <MessageList messages={messages} isStreaming={isStreaming} />
          <InputArea
            onSendMessage={handleSendMessage}
            onStop={handleStopStream}
            isStreaming={isStreaming}
            onUploadAttachment={handleUploadAttachment}
          />
        </main>
      </div>

      {/* Interactive Shell Console Modal */}
      <ShellModal
        isOpen={isShellConsoleOpen}
        onClose={() => setIsShellConsoleOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        embedModels={availableEmbedModels}
      />
    </div>
  );
}
export default App;
