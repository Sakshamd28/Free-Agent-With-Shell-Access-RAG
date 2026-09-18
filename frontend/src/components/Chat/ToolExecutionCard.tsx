import React, { useState } from 'react';
import { Terminal, Check, Copy, ChevronDown, ChevronUp, Database } from 'lucide-react';
import type { ToolCallItem, ToolResultItem } from '../../types';

interface ToolExecutionCardProps {
  toolCall: ToolCallItem;
  toolResult?: ToolResultItem;
}

export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = ({
  toolCall,
  toolResult,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isShell = toolCall.name === 'execute_shell_command';
  const command = toolCall.args?.command || '';
  const query = toolCall.args?.query || '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isShell) {
    const meta = toolResult?.meta;
    const isSuccess = meta ? meta.returncode === 0 : true;
    const output = meta ? (meta.stdout || meta.stderr) : toolResult?.output || '';

    return (
      <div className="my-2.5 rounded-xl border border-gray-700/80 bg-[#0d1117] overflow-hidden shadow-lg font-mono text-xs">
        {/* Terminal Header Bar */}
        <div className="bg-[#161b22] px-3 py-2 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-1.5 ml-2 text-gray-300 font-semibold text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shell Execution</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {meta && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  isSuccess
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                }`}
              >
                rc: {meta.returncode} ({meta.duration}s)
              </span>
            )}

            <button
              onClick={() => copyToClipboard(command)}
              className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-800"
              title="Copy command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-800"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Command display */}
        <div className="px-3 py-2 bg-[#090d13] border-b border-gray-800/60 flex items-center gap-2 text-cyan-300">
          <span className="text-emerald-400 select-none">$</span>
          <span className="font-semibold select-all">{command}</span>
        </div>

        {/* Output container */}
        {isExpanded && (
          <div className="p-3 bg-[#0d1117] text-gray-300 overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap select-text text-[11px]">
            {!toolResult ? (
              <div className="flex items-center gap-2 text-amber-400/90 py-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                Executing in system shell...
              </div>
            ) : output ? (
              output
            ) : (
              <span className="text-gray-500 italic">(command completed with no console output)</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Knowledge Base Search Tool Card
  return (
    <div className="my-2.5 rounded-xl border border-emerald-500/30 bg-[#0d1912] overflow-hidden shadow-md text-xs">
      <div className="bg-[#112219] px-3 py-2 border-b border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-300 font-semibold text-[11px]">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Knowledge Base Query</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-emerald-400/80 hover:text-emerald-300 p-1"
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="px-3 py-1.5 bg-[#09150e] border-b border-emerald-950 text-emerald-200/90 text-[11px]">
        <span className="text-gray-400">Query: </span>
        <span className="italic">"{query}"</span>
      </div>

      {isExpanded && (
        <div className="p-3 text-gray-300 overflow-x-auto max-h-48 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
          {!toolResult ? (
            <div className="text-emerald-400/80 animate-pulse">Searching vector store...</div>
          ) : (
            toolResult.output
          )}
        </div>
      )}
    </div>
  );
};
