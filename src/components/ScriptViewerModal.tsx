import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode, Terminal } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface ScriptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bashScript: string;
  nginxConfig: string;
  domain: string;
  language: Language;
}

export const ScriptViewerModal: React.FC<ScriptViewerModalProps> = ({
  isOpen,
  onClose,
  bashScript,
  nginxConfig,
  domain,
  language,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'bash' | 'nginx'>('bash');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentContent = activeTab === 'bash' ? bashScript : nginxConfig;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeTab === 'bash' ? 'deploy.sh' : `${domain || 'app'}.nginx.conf`;
    const blob = new Blob([currentContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {language === 'el' ? 'Προβολή Παραγόμενων Scripts & Ρυθμίσεων' : 'Generated Scripts & Configuration'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector & Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('bash')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'bash'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>deploy.sh (Bash Script)</span>
            </button>
            <button
              onClick={() => setActiveTab('nginx')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'nginx'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Nginx Reverse Proxy Config</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.copied : t.copy}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Script Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300">
          <pre className="whitespace-pre-wrap leading-relaxed select-text">
            {currentContent}
          </pre>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <span>
            {language === 'el'
              ? '💡 Μπορείτε να αντιγράψετε το script και να το τρέξετε χειροκίνητα στο VPS με: '
              : '💡 You can copy and execute this script directly on your VPS via: '}
            <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-300 border border-slate-800 font-mono">
              bash deploy.sh
            </code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
};
