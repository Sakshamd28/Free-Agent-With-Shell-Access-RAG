import React, { useState } from 'react';
import { Settings as SettingsIcon, X, Key, Eye, EyeOff, Database, Save, Check } from 'lucide-react';
import type { AppSettings, EmbedModelInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  embedModels: EmbedModelInfo[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  embedModels,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-[#161f30]">
          <div className="flex items-center gap-2 text-white font-semibold text-sm md:text-base">
            <SettingsIcon className="w-4 h-4 text-emerald-400" />
            <span>Agent & Security Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* NVIDIA API Key */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              NVIDIA API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="nvapi-..."
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full bg-[#1e293b] border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Used for Chat LLM and Knowledge Base Embeddings (NVIDIA NIM). Can also be set via{' '}
              <code className="text-gray-400">NVIDIA_API_KEY</code> environment variable.
            </p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">NVIDIA Base URL</label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Embedding Model */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Knowledge Base Embedding Model
            </label>
            <select
              value={formData.embedModel}
              onChange={(e) => setFormData({ ...formData, embedModel: e.target.value })}
              className="w-full bg-[#1e293b] border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              {embedModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              Changing embedding model will re-index your documents on next upload.
            </p>
          </div>

          {/* Sliders: Temperature and RAG Score */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800">
            <div>
              <div className="flex justify-between text-gray-300 font-medium mb-1">
                <span>Temperature</span>
                <span className="font-mono text-emerald-400">{formData.temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={formData.temperature}
                onChange={(e) =>
                  setFormData({ ...formData, temperature: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-300 font-medium mb-1">
                <span>RAG Min Score</span>
                <span className="font-mono text-emerald-400">{formData.ragMinScore}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={formData.ragMinScore}
                onChange={(e) =>
                  setFormData({ ...formData, ragMinScore: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-1.5 transition-all shadow-md"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
