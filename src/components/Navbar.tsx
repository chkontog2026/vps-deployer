import React from 'react';
import { Server, Globe, Terminal, ShieldCheck, Plus, Layers } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface NavbarProps {
  currentTab: 'wizard' | 'projects' | 'doctor' | 'dns';
  onSelectTab: (tab: 'wizard' | 'projects' | 'doctor' | 'dns') => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  projectsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  language,
  onToggleLanguage,
  projectsCount,
}) => {
  const t = translations[language];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('wizard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Server className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                ShipVPS
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onSelectTab('wizard')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'wizard'
                ? 'text-white border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.newDeployment}
          </button>
          <button
            onClick={() => onSelectTab('projects')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              currentTab === 'projects'
                ? 'text-white border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.projects}
            {projectsCount > 0 && (
              <span className="text-xs text-slate-400 font-mono tabular-nums">({projectsCount})</span>
            )}
          </button>
          <button
            onClick={() => onSelectTab('doctor')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'doctor'
                ? 'text-white border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.doctor}
          </button>
          <button
            onClick={() => onSelectTab('dns')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'dns'
                ? 'text-white border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DNS Checker
          </button>
        </nav>

        {/* Zone 3: Actions & Language Toggle */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => onToggleLanguage('el')}
              className={`px-2 py-1 rounded transition-colors ${
                language === 'el'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ΕΛ
            </button>
            <button
              onClick={() => onToggleLanguage('en')}
              className={`px-2 py-1 rounded transition-colors ${
                language === 'en'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          <button
            onClick={() => onSelectTab('wizard')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{t.newDeployment}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
