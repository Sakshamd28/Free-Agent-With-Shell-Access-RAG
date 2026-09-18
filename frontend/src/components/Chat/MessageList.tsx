import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shield, User, Copy, Check, Sparkles, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { ToolExecutionCard } from './ToolExecutionCard';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto select-none">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">AI Security Agent Ready</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Equipped with direct shell execution, automatic vector RAG on your uploaded documents,
            and specialized security reasoning.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
            <div className="p-3 rounded-xl bg-[#1e293b]/50 border border-gray-800 text-xs text-gray-300">
              <span className="font-semibold text-emerald-400 block mb-1">Local RAG Ingestion</span>
              Upload PDFs, source code, or logs in the sidebar to ask questions with citations.
            </div>
            <div className="p-3 rounded-xl bg-[#1e293b]/50 border border-gray-800 text-xs text-gray-300">
              <span className="font-semibold text-cyan-400 block mb-1">Shell Execution</span>
              Ask to run network diagnostics, system audits, or check ports on your machine.
            </div>
            <div className="p-3 rounded-xl bg-[#1e293b]/50 border border-gray-800 text-xs text-gray-300">
              <span className="font-semibold text-amber-400 block mb-1">Model Selection</span>
              Switch between Nemotron, Llama 3.3, Mistral, or DeepSeek R1 anytime.
            </div>
            <div className="p-3 rounded-xl bg-[#1e293b]/50 border border-gray-800 text-xs text-gray-300">
              <span className="font-semibold text-indigo-400 block mb-1">Slash Commands</span>
              Type <code className="text-emerald-400">/upload</code>, <code className="text-emerald-400">/docs</code>, or <code className="text-emerald-400">/help</code> in chat.
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
      )}
    </div>
  );
};

const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const [showHits, setShowHits] = useState(false);

  return (
    <div className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 shadow-sm">
          <Shield className="w-4 h-4" />
        </div>
      )}

      {/* Bubble / Container */}
      <div className={`max-w-[85%] md:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-gray-400">
          <span className="font-medium text-gray-300">{isUser ? 'You' : 'Security Agent'}</span>
          <span>•</span>
          <span>{message.timestamp}</span>
        </div>

        {/* Message Card */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-md ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-none'
              : 'bg-[#161f30] border border-gray-700/80 text-gray-100 rounded-tl-none w-full'
          }`}
        >
          {/* Automatic RAG Context Banner */}
          {!isUser && message.ragHits && message.ragHits.length > 0 && (
            <div className="mb-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 overflow-hidden text-xs">
              <button
                onClick={() => setShowHits(!showHits)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-emerald-300 hover:bg-emerald-900/30 text-[11px] font-medium"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Retrieved {message.ragHits.length} knowledge base excerpt(s)</span>
                </div>
                {showHits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showHits && (
                <div className="p-2.5 pt-1 space-y-1.5 border-t border-emerald-900/40 bg-black/20 text-[11px]">
                  {message.ragHits.map((h, i) => (
                    <div key={i} className="p-2 rounded bg-[#0b1411] border border-emerald-800/40">
                      <div className="flex justify-between items-center text-emerald-400 font-mono text-[10px] mb-1">
                        <span className="truncate">{h.filename} (chunk {h.chunk})</span>
                        <span className="bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-600/30">
                          score: {h.score.toFixed(3)}
                        </span>
                      </div>
                      <p className="text-gray-300 line-clamp-3 text-[11px] font-mono leading-relaxed">
                        {h.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tool Calls & Results (Shell execution, KB search) */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2 mb-3">
              {message.toolCalls.map((tc) => {
                const tr = message.toolResults?.find((r) => r.id === tc.id);
                return <ToolExecutionCard key={tc.id} toolCall={tc} toolResult={tr} />;
              })}
            </div>
          )}

          {/* Assistant Thinking Pulse */}
          {!isUser && message.isThinking && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs py-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyzing security context & executing tools...</span>
            </div>
          )}

          {/* Error Banner */}
          {message.error && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs my-2">
              {message.error}
            </div>
          )}

          {/* Markdown Content */}
          {message.content && (
            <div className={`prose-dark max-w-none text-xs md:text-sm ${isUser ? 'text-white' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    return !isInline ? (
                      <CodeBlock language={match ? match[1] : ''}>
                        {String(children).replace(/\n$/, '')}
                      </CodeBlock>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-200 flex-shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

const CodeBlock: React.FC<{ language: string; children: string }> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-gray-800 bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] text-gray-400 text-[11px] font-mono border-b border-gray-800">
        <span>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-800 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] font-mono text-gray-200 leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
};
