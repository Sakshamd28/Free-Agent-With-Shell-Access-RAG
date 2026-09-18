import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip, Command } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  onUploadAttachment: (files: FileList) => void;
}

const SLASH_COMMANDS = [
  { cmd: '/upload', desc: 'Index a file or directory into KB (e.g. /upload C:\\logs)' },
  { cmd: '/docs', desc: 'List all indexed knowledge base sources' },
  { cmd: '/drop', desc: 'Remove one source or clear KB (e.g. /drop report.pdf)' },
  { cmd: '/search', desc: 'Raw similarity vector search debug (e.g. /search CVE-2024)' },
  { cmd: '/rag on', desc: 'Turn automatic retrieval injection ON' },
  { cmd: '/rag off', desc: 'Turn automatic retrieval injection OFF' },
  { cmd: '/reset', desc: 'Clear chat conversation history' },
  { cmd: '/help', desc: 'Show all available CLI and chat commands' },
];

export const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  onStop,
  isStreaming,
  onUploadAttachment,
}) => {
  const [text, setText] = useState('');
  const [showCommandsMenu, setShowCommandsMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (text.startsWith('/')) {
      const query = text.toLowerCase();
      const matches = SLASH_COMMANDS.filter((c) => c.cmd.toLowerCase().startsWith(query));
      setFilteredCommands(matches);
      setShowCommandsMenu(matches.length > 0);
      setSelectedCmdIndex(0);
    } else {
      setShowCommandsMenu(false);
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandsMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const selected = filteredCommands[selectedCmdIndex];
        if (selected) {
          setText(selected.cmd + ' ');
          setShowCommandsMenu(false);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || isStreaming) return;
    onSendMessage(text.trim());
    setText('');
    setShowCommandsMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const selectCommand = (cmd: string) => {
    setText(cmd + ' ');
    setShowCommandsMenu(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="p-3 md:p-4 bg-[#0f172a] border-t border-gray-800 relative">
      {/* Slash Commands Dropup Menu */}
      {showCommandsMenu && (
        <div className="absolute bottom-full left-4 right-4 md:left-6 md:right-6 mb-2 bg-[#111827] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1.5 bg-[#161f30] border-b border-gray-800 text-[11px] font-semibold text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Command className="w-3.5 h-3.5 text-emerald-400" />
              Chat & KB Commands
            </span>
            <span className="text-[10px] text-gray-500">Tab / Enter to select • Esc to dismiss</span>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredCommands.map((c, i) => (
              <div
                key={c.cmd}
                onClick={() => selectCommand(c.cmd)}
                className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                  i === selectedCmdIndex ? 'bg-[#1e293b] text-emerald-300' : 'text-gray-300 hover:bg-gray-800/60'
                }`}
              >
                <span className="font-mono font-semibold text-emerald-400">{c.cmd}</span>
                <span className="text-[11px] text-gray-400">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Box */}
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-2 bg-[#161f30] border border-gray-700 hover:border-gray-600 focus-within:border-emerald-500/80 rounded-2xl p-2 transition-all shadow-lg">
          {/* File Attachment Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onUploadAttachment(e.target.files);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-emerald-400 rounded-xl hover:bg-gray-800/80 transition-colors flex-shrink-0"
            title="Attach documents to index into Knowledge Base"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask a security question, run shell commands, or type / for commands..."
            className="flex-1 max-h-44 bg-transparent resize-none border-none outline-none text-xs md:text-sm text-gray-100 placeholder-gray-500 py-2 leading-relaxed"
          />

          {/* Send / Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition-all flex-shrink-0"
              title="Stop response"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl shadow-md transition-all flex-shrink-0"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 px-2 mt-1.5 select-none">
          <div className="flex items-center gap-2">
            <span>Type <code className="text-gray-400">/help</code> for quick commands</span>
            <span>•</span>
            <span>Shell access enabled</span>
          </div>
          <span>Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
};
