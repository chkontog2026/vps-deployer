import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, Download, Trash2, ArrowDown } from 'lucide-react';
import { DeploymentLog } from '../types';

interface TerminalConsoleProps {
  logs: DeploymentLog[];
  isDeploying: boolean;
  onClearLogs?: () => void;
  title?: string;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  logs,
  isDeploying,
  onClearLogs,
  title = 'Live Deployment Console',
}) => {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    const rawText = logs.map((l) => `[${l.timestamp.slice(11, 19)}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const rawText = logs.map((l) => `[${l.timestamp}] ${l.message}`).join('\n');
    const blob = new Blob([rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-slate-400 select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-slate-300 font-semibold flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            {title}
          </span>
          {isDeploying && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Running...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-colors ${
              autoScroll ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Auto-scroll"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>
          <button
            onClick={handleCopy}
            className="p-1 hover:text-slate-200 transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 hover:text-slate-200 transition-colors"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1 hover:text-rose-400 transition-colors"
              title="Clear terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Console Body */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-1 bg-black/60 min-h-[300px] max-h-[500px]"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            {isDeploying ? 'Αναμονή για έναρξη διαδικασίας...' : 'Δεν υπάρχουν καταγραφές. Πατήστε "Έναρξη Ανάπτυξης" για να ξεκινήσετε.'}
          </div>
        ) : (
          logs.map((log) => {
            const time = log.timestamp ? log.timestamp.slice(11, 19) : '--:--:--';

            let textColor = 'text-slate-300';
            if (log.type === 'step') textColor = 'text-cyan-400 font-semibold';
            if (log.type === 'success') textColor = 'text-emerald-400 font-medium';
            if (log.type === 'warn') textColor = 'text-amber-400';
            if (log.type === 'error') textColor = 'text-rose-400 font-medium';
            if (log.type === 'info') textColor = 'text-blue-300';

            return (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed break-all">
                <span className="text-slate-600 select-none text-[11px] tabular-nums shrink-0">
                  {time}
                </span>
                <span className={textColor}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
