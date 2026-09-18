import React, { useState } from 'react';
import { Shield, Terminal, Cpu, Database, Settings as SettingsIcon, Check, ChevronDown } from 'lucide-react';
import type { ModelInfo } from '../types';

interface HeaderProps {
  chatModel: string;
  onSelectModel: (modelId: string) => void;
  availableModels: ModelInfo[];
  ragEnabled: boolean;
  onToggleRag: () => void;
  kbChunksCount: number;
  onOpenSettings: () => void;
  onToggleShellConsole: () => void;
  isShellConsoleOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  chatModel,
  onSelectModel,
  availableModels,
  ragEnabled,
  onToggleRag,
  kbChunksCount,
  onOpenSettings,
  onToggleShellConsole,
  isShellConsoleOpen,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  const currentModelObj = availableModels.find((m) => m.id === chatModel);
  const displayName = currentModelObj ? currentModelObj.name : chatModel;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim()) {
      onSelectModel(customModelInput.trim());
      setCustomModelMode(false);
      setModelDropdownOpen(false);
    }
  };

  return (
    <header className="h-16 bg-[#0f172a]/95 border-b border-gray-800 px-4 md:px-6 flex items-center justify-between z-30 sticky top-0 backdrop-blur-md">
      {/* Left: Brand / Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              SEC-AGENT
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
                v2.0
              </span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">Autonomous Security & Shell Agent</p>
        </div>
      </div>

      {/* Center/Right: Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 bg-[#1e293b]/90 hover:bg-[#334155] border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 text-xs md:text-sm font-medium text-gray-200 transition-all shadow-sm"
            title="Select AI Reasoning Model"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="max-w-[140px] md:max-w-[200px] truncate">{displayName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 md:w-80 bg-[#111827] border border-gray-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Select Model
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {availableModels.map((m) => {
                  const isSelected = m.id === chatModel;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-[#1f2937] transition-colors ${
                        isSelected ? 'bg-emerald-950/30 text-emerald-300' : 'text-gray-300'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isSelected ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center justify-between">
                          <span>{m.name}</span>
                          {m.provider && (
                            <span className="text-[10px] text-gray-500 font-normal px-1 rounded bg-gray-800">
                              {m.provider}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">{m.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Model Input */}
              <div className="p-2 border-t border-gray-800 bg-[#0b0f19]">
                {!customModelMode ? (
                  <button
                    onClick={() => setCustomModelMode(true)}
                    className="w-full text-center text-xs text-emerald-400 hover:text-emerald-300 py-1 font-medium hover:underline"
                  >
                    + Use Custom Model ID
                  </button>
                ) : (
                  <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. meta/llama-3-8b"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      className="flex-1 bg-[#1e293b] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                    >
                      Apply
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RAG Toggle Pill */}
        <button
          onClick={onToggleRag}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            ragEnabled
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'bg-gray-800/60 border-gray-700 text-gray-400'
          }`}
          title={ragEnabled ? 'RAG is active: Knowledge Base is searched' : 'RAG is paused'}
        >
          <Database className={`w-3.5 h-3.5 ${ragEnabled ? 'text-emerald-400' : 'text-gray-400'}`} />
          <span className="hidden sm:inline">RAG:</span>
          <span>{ragEnabled ? 'ON' : 'OFF'}</span>
          {kbChunksCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-900/80 text-[10px] font-mono text-emerald-300">
              {kbChunksCount}
            </span>
          )}
        </button>

        {/* Interactive Shell Console Toggle */}
        <button
          onClick={onToggleShellConsole}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isShellConsoleOpen
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
              : 'bg-[#1e293b]/90 hover:bg-[#334155] border-gray-700 text-gray-300'
          }`}
          title="Open interactive terminal console"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Shell</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg bg-[#1e293b]/90 hover:bg-[#334155] border border-gray-700 text-gray-300 hover:text-white transition-colors"
          title="Configure API Keys & Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
