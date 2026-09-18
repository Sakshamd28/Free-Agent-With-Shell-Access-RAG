import React, { useState, useRef } from 'react';
import {
  Upload,
  FolderPlus,
  FileText,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  Terminal,
  RefreshCw,
  FileCode,
  File,
  AlertCircle
} from 'lucide-react';
import type { KbSource } from '../types';
import { uploadFiles, indexLocalPath, dropSource, clearKb, searchKb } from '../services/api';

interface SidebarProps {
  sources: KbSource[];
  totalChunks: number;
  apiKey: string;
  embedModel: string;
  onRefreshSources: () => void;
  onInsertCommandPrompt?: (cmd: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  totalChunks,
  apiKey,
  embedModel,
  onRefreshSources,
  onInsertCommandPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'kb' | 'shortcuts'>('kb');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [localPathInput, setLocalPathInput] = useState('');
  const [pathIndexing, setPathIndexing] = useState(false);

  // Search debug modal/drawer state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadStatus(`Indexing ${files.length} file(s)...`);

    try {
      const fileArray = Array.from(files);
      const res = await uploadFiles(fileArray, apiKey, embedModel);
      setUploadStatus(
        `Successfully indexed ${res.indexed.length} file(s) into ${res.total_chunks} chunk(s)!`
      );
      onRefreshSources();
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err: any) {
      setUploadStatus(`Upload error: ${err.message}`);
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIndexPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPathInput.trim()) return;

    setPathIndexing(true);
    try {
      const res = await indexLocalPath(localPathInput.trim(), apiKey, embedModel);
      if (res.success) {
        setUploadStatus(`Indexed ${res.indexed.length} file(s) from path!`);
        setLocalPathInput('');
        onRefreshSources();
      } else {
        setUploadStatus(`Warning: ${res.message}`);
      }
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err: any) {
      setUploadStatus(`Path error: ${err.message}`);
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setPathIndexing(false);
    }
  };

  const handleDropSource = async (sourceName: string) => {
    if (!confirm(`Remove "${sourceName}" from knowledge base?`)) return;
    try {
      await dropSource(sourceName);
      onRefreshSources();
    } catch (err: any) {
      alert(`Failed to remove: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear the entire knowledge base?')) return;
    try {
      await clearKb();
      onRefreshSources();
      setSearchResults(null);
    } catch (err: any) {
      alert(`Clear failed: ${err.message}`);
    }
  };

  const handleSearchDebug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await searchKb(searchQuery.trim(), apiKey, embedModel, 4);
      setSearchResults(res.hits);
    } catch (err: any) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-rose-400" />;
    if (['py', 'js', 'ts', 'sh', 'ps1', 'c', 'cpp', 'go', 'rs'].includes(ext || ''))
      return <FileCode className="w-3.5 h-3.5 text-emerald-400" />;
    return <File className="w-3.5 h-3.5 text-blue-400" />;
  };

  const securityShortcuts = [
    { label: 'Check Host Identity', cmd: 'whoami' },
    { label: 'Network Adapter Config', cmd: 'ipconfig /all' },
    { label: 'Active Ports & Connections', cmd: 'netstat -ano' },
    { label: 'ARP Table Inspection', cmd: 'arp -a' },
    { label: 'System Architecture & Info', cmd: 'systeminfo' },
    { label: 'List Running Tasks', cmd: 'tasklist' },
    { label: 'DNS Connectivity Test', cmd: 'ping 8.8.8.8 -n 4' },
    { label: 'Check Open Web Port', cmd: 'curl -I http://localhost:8000' },
  ];

  return (
    <aside className="w-80 bg-[#0f172a] border-r border-gray-800 flex flex-col h-[calc(100vh-4rem)] select-none">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-gray-800 p-2 gap-1.5 bg-[#0b0f19]">
        <button
          onClick={() => setActiveTab('kb')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'kb'
              ? 'bg-[#1e293b] text-emerald-400 shadow-sm border border-gray-700'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Knowledge Base ({totalChunks})
        </button>
        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'shortcuts'
              ? 'bg-[#1e293b] text-cyan-400 shadow-sm border border-gray-700'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Diagnostics
        </button>
      </div>

      {activeTab === 'kb' ? (
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
              isUploading
                ? 'border-emerald-500/80 bg-emerald-950/20'
                : 'border-gray-700 hover:border-emerald-500/50 hover:bg-gray-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <div className="flex flex-col items-center gap-1.5 text-gray-400">
              <div className="w-8 h-8 rounded-full bg-[#1e293b] border border-gray-700 flex items-center justify-center text-emerald-400">
                <Upload className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-gray-200">
                {isUploading ? 'Indexing files...' : 'Upload files into KB'}
              </span>
              <span className="text-[10px] text-gray-500">
                PDFs, code, logs, markdown, txt, csv, json
              </span>
            </div>
          </div>

          {/* Index Local Folder or File Path */}
          <form onSubmit={handleIndexPath} className="flex gap-1.5">
            <input
              type="text"
              placeholder="Or index path: C:\logs or ./docs"
              value={localPathInput}
              onChange={(e) => setLocalPathInput(e.target.value)}
              disabled={pathIndexing}
              className="flex-1 bg-[#1e293b] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={pathIndexing || !localPathInput.trim()}
              className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1"
              title="Index local directory or file"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </form>

          {uploadStatus && (
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{uploadStatus}</span>
            </div>
          )}

          {/* Similarity Search Inspector Toggle */}
          <div>
            <button
              onClick={() => setShowSearchBox(!showSearchBox)}
              className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 py-1"
            >
              <span className="flex items-center gap-1 font-medium">
                <Search className="w-3 h-3 text-emerald-400" /> Similarity Search Debugger
              </span>
              {showSearchBox ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {showSearchBox && (
              <div className="mt-1.5 p-2 bg-[#111827] border border-gray-800 rounded-lg">
                <form onSubmit={handleSearchDebug} className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Enter query to test RAG scores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-[#1e293b] border border-gray-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px]"
                  >
                    Test
                  </button>
                </form>

                {searchResults && (
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[10px]">
                    {searchResults.length === 0 ? (
                      <div className="text-gray-500 text-center py-1">No hits found</div>
                    ) : (
                      searchResults.map((hit, idx) => (
                        <div key={idx} className="p-1.5 bg-[#1e293b] rounded border border-gray-800">
                          <div className="flex justify-between items-center text-emerald-400 font-mono">
                            <span className="truncate max-w-[140px]">{hit.source.split(/[\\/]/).pop()}</span>
                            <span className="px-1 rounded bg-emerald-950 text-emerald-300">
                              {(hit.score).toFixed(3)}
                            </span>
                          </div>
                          <p className="text-gray-300 line-clamp-2 mt-0.5">{hit.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sources Header & Clear All */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-500">
              Indexed Documents ({sources.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefreshSources}
                className="text-gray-400 hover:text-white"
                title="Refresh list"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              {sources.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {sources.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                No documents uploaded yet.
                <div className="text-[11px] text-gray-600 mt-1">
                  Drag files above or use <span className="font-mono text-emerald-500">/upload</span>
                </div>
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.source}
                  className="group flex items-center justify-between p-2 rounded-lg bg-[#1e293b]/50 hover:bg-[#1e293b] border border-gray-800/80 hover:border-gray-700 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(src.filename)}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-200 truncate" title={src.source}>
                        {src.filename}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {src.chunks} chunk{src.chunks > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDropSource(src.source)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-400 transition-opacity"
                    title={`Remove ${src.filename}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Diagnostic Shortcuts Tab */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-[11px] text-gray-400 mb-2">
            Click any security diagnosis tool to prompt the agent to execute or analyze it:
          </div>
          {securityShortcuts.map((s, idx) => (
            <div
              key={idx}
              onClick={() => onInsertCommandPrompt?.(`Execute shell command "${s.cmd}" and explain the security output.`)}
              className="p-2.5 rounded-lg bg-[#1e293b]/60 hover:bg-[#1e293b] border border-gray-800 hover:border-cyan-500/40 cursor-pointer transition-all group"
            >
              <div className="text-xs font-medium text-gray-200 group-hover:text-cyan-300 flex items-center justify-between">
                <span>{s.label}</span>
                <Terminal className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400" />
              </div>
              <div className="text-[11px] font-mono text-cyan-400/80 mt-1 bg-black/40 px-1.5 py-0.5 rounded truncate">
                $ {s.cmd}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
