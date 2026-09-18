import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, X, RefreshCw, Check, Copy } from 'lucide-react';
import type { ShellExecMeta } from '../../types';
import { execShellCommand, fetchShellHistory } from '../../services/api';

interface ShellModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShellModal: React.FC<ShellModalProps> = ({ isOpen, onClose }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<ShellExecMeta[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = async () => {
    try {
      const res = await fetchShellHistory();
      setHistory(res.history);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isExecuting) return;

    const cmdToRun = command.trim();
    setIsExecuting(true);
    setCommand('');

    try {
      const res = await execShellCommand(cmdToRun);
      setHistory((prev) => [res, ...prev]);
    } catch (err: any) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[85vh] bg-[#0b0f19] border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono">
        {/* Terminal Header */}
        <div className="bg-[#111827] px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>
            <div className="flex items-center gap-2 text-gray-200 font-semibold text-xs md:text-sm">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Interactive Host Shell Console</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadHistory}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Refresh history"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command Runner Bar */}
        <form onSubmit={handleRun} className="p-3 bg-[#161f30] border-b border-gray-800 flex gap-2">
          <div className="flex items-center gap-2 flex-1 bg-[#090d13] border border-gray-700 focus-within:border-cyan-500 rounded-xl px-3 py-2 text-xs md:text-sm">
            <span className="text-emerald-400 select-none font-bold">$</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter shell command (e.g. whoami, netstat -ano, ping 127.0.0.1, dir)..."
              disabled={isExecuting}
              className="flex-1 bg-transparent text-white focus:outline-none placeholder-gray-500"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isExecuting || !command.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run</span>
          </button>
        </form>

        {/* Output History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d1117] text-xs">
          {isExecuting && (
            <div className="p-3 rounded-lg bg-[#161b22] border border-cyan-500/40 text-cyan-300 animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
              Running command...
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-xs">
              <Terminal className="w-10 h-10 mx-auto mb-2 opacity-30 text-cyan-400" />
              No shell commands executed yet.
              <div className="text-gray-600 mt-1">
                Type a command above or let the security agent run tools.
              </div>
            </div>
          ) : (
            history.map((item, idx) => {
              const output = item.stdout || item.stderr || '(no console output)';
              const isSuccess = item.returncode === 0;
              const id = item.id || `hist-${idx}`;

              return (
                <div
                  key={id}
                  className="rounded-xl border border-gray-800 bg-[#161b22] overflow-hidden shadow-sm"
                >
                  {/* Command title line */}
                  <div className="px-3 py-2 bg-[#090d13] border-b border-gray-800/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-emerald-400">$</span>
                      <span className="font-bold text-cyan-300 truncate">{item.command}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isSuccess
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        rc: {item.returncode} ({item.duration}s)
                      </span>
                      <span className="text-gray-500 text-[10px]">{item.timestamp}</span>
                      <button
                        onClick={() => handleCopy(id, output)}
                        className="text-gray-400 hover:text-white p-1"
                        title="Copy output"
                      >
                        {copiedId === id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Stderr / Stdout Output */}
                  <pre className="p-3 text-gray-200 overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap select-text text-[11px]">
                    {item.stderr && (
                      <span className="text-rose-400 block mb-1 font-semibold">{item.stderr}</span>
                    )}
                    {item.stdout}
                  </pre>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
