import React, { useState, useEffect } from 'react';
import {
  Github,
  Server,
  Globe,
  Play,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowRight,
  ArrowLeft,
  Key,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  BookmarkCheck,
  Save,
} from 'lucide-react';
import {
  ProjectType,
  RepositoryConfig,
  VpsCredentials,
  DomainConfig,
  DeploymentLog,
  DeploymentProject,
} from '../types';
import { Language, translations } from '../lib/translations';
import { TerminalConsole } from './TerminalConsole';
import { buildBashScript, buildNginxConfig } from '../lib/deployGenerator';

interface DeployWizardProps {
  onDeploymentComplete: (project: DeploymentProject) => void;
  language: Language;
  onOpenScriptModal: (bashScript: string, nginxConfig: string, domain: string) => void;
  initialProject?: DeploymentProject | null;
}

export const DeployWizard: React.FC<DeployWizardProps> = ({
  onDeploymentComplete,
  language,
  onOpenScriptModal,
  initialProject,
}) => {
  const t = translations[language];

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // 1. Repo State
  const [repoConfig, setRepoConfig] = useState<RepositoryConfig>({
    repoUrl: initialProject?.repo.repoUrl || 'https://github.com/chkontog2026/google-ai-chat-translator',
    branch: initialProject?.repo.branch || 'main',
    projectType: initialProject?.repo.projectType || 'vite-spa',
    buildCommand: initialProject?.repo.buildCommand || 'npm install && npm run build',
    startCommand: initialProject?.repo.startCommand || 'serve-static',
    appPort: initialProject?.repo.appPort || 80,
    deployPath: initialProject?.repo.deployPath || '/var/www/app',
    envVars: initialProject?.repo.envVars || '# GEMINI_API_KEY: Required for Gemini AI API calls.\nGEMINI_API_KEY=""\nAPP_URL="https://app.example.com"',
  });

  // 2. VPS State
  const [vpsConfig, setVpsConfig] = useState<VpsCredentials>({
    host: initialProject?.vps.host || '',
    port: initialProject?.vps.port || 22,
    username: initialProject?.vps.username || 'root',
    password: initialProject?.vps.password || '',
    privateKey: initialProject?.vps.privateKey || '',
    authType: initialProject?.vps.authType || 'password',
  });

  // 3. Domain State
  const [domainConfig, setDomainConfig] = useState<DomainConfig>({
    domain: initialProject?.domain.domain || 'app.example.com',
    enableSsl: initialProject?.domain.enableSsl ?? true,
    email: initialProject?.domain.email || 'admin@example.com',
  });

  // Diagnostics & Status
  const [analyzingRepo, setAnalyzingRepo] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);

  const [testingConnection, setTestingConnection] = useState(false);
  const [vpsConnectionResult, setVpsConnectionResult] = useState<{
    success: boolean;
    message: string;
    diagnostics?: any;
  } | null>(null);

  const [checkingDns, setCheckingDns] = useState(false);
  const [dnsResult, setDnsResult] = useState<{
    matches?: boolean;
    resolvedIps?: string[];
    message?: string;
  } | null>(null);

  // Deployment Logs & Execution
  const [isDeploying, setIsDeploying] = useState(false);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [activeStepProgress, setActiveStepProgress] = useState(1);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  // Persistence (saved VPS credentials and default domain settings)
  const [hasSavedDefaults, setHasSavedDefaults] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Load persistent settings on mount
  useEffect(() => {
    if (initialProject) return;

    // 1. Instant hydration from browser localStorage
    try {
      const local = localStorage.getItem('shipvps_persistent_settings');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.vps?.host) {
          setVpsConfig((prev) => ({
            ...prev,
            host: parsed.vps.host || prev.host,
            port: parsed.vps.port || prev.port,
            username: parsed.vps.username || prev.username,
            password: parsed.vps.password || prev.password,
            privateKey: parsed.vps.privateKey || prev.privateKey,
            authType: parsed.vps.authType || prev.authType,
          }));
          setHasSavedDefaults(true);
        }
        if (parsed.domain?.email) {
          setDomainConfig((prev) => ({
            ...prev,
            email: parsed.domain.email || prev.email,
          }));
        }
      }
    } catch {}

    // 2. Fetch server-side defaults from /api/settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          const s = data.settings;
          if (s.vps?.host) {
            setVpsConfig((prev) => ({
              ...prev,
              host: prev.host || s.vps.host,
              port: prev.port || s.vps.port || 22,
              username: prev.username || s.vps.username || 'root',
              password: prev.password || s.vps.password || '',
              privateKey: prev.privateKey || s.vps.privateKey || '',
              authType: s.vps.authType || prev.authType,
            }));
            setHasSavedDefaults(true);
          }
          if (s.domain?.email) {
            setDomainConfig((prev) => ({
              ...prev,
              email: (!prev.email || prev.email === 'admin@example.com') ? s.domain.email : prev.email,
            }));
          }
        }
      })
      .catch(() => {});
  }, [initialProject]);

  const handleSaveSettings = async () => {
    const payload = {
      vps: vpsConfig,
      domain: { email: domainConfig.email, enableSsl: domainConfig.enableSsl },
      saveDefaults: true,
    };
    try {
      localStorage.setItem('shipvps_persistent_settings', JSON.stringify(payload));
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setHasSavedDefaults(true);
      setSaveFeedback('✓ Αποθηκεύτηκαν μόνιμα!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (e) {
      setSaveFeedback('Σφάλμα αποθήκευσης');
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  const handleClearSettings = async () => {
    try {
      localStorage.removeItem('shipvps_persistent_settings');
      await fetch('/api/settings', { method: 'DELETE' });
      setHasSavedDefaults(false);
      setSaveFeedback('Εκκαθαρίστηκαν');
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch {}
  };

  // Presets
  const presets: { label: string; type: ProjectType; port: number; build: string; start: string }[] = [
    {
      label: 'Next.js (SSR)',
      type: 'nextjs',
      port: 3000,
      build: 'npm install --legacy-peer-deps && npm run build',
      start: 'npm start',
    },
    {
      label: 'Node.js / Express',
      type: 'nodejs',
      port: 3000,
      build: 'npm install --legacy-peer-deps',
      start: 'node server.js || npm start',
    },
    {
      label: 'Docker / Compose',
      type: 'docker',
      port: 3000,
      build: 'docker compose build',
      start: 'docker compose up -d',
    },
    {
      label: 'React / Vite SPA',
      type: 'vite-spa',
      port: 80,
      build: 'npm install --legacy-peer-deps && npm run build',
      start: 'serve-static',
    },
    {
      label: 'Python (FastAPI / Flask)',
      type: 'python',
      port: 8000,
      build: 'python3 -m venv venv && ./venv/bin/pip install -r requirements.txt',
      start: './venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000',
    },
  ];

  // Helper to apply preset
  const applyPreset = (preset: (typeof presets)[0]) => {
    setRepoConfig((prev) => ({
      ...prev,
      projectType: preset.type,
      appPort: preset.port,
      buildCommand: preset.build,
      startCommand: preset.start,
    }));
  };

  // Analyze GitHub Repository
  const handleAnalyzeRepo = async () => {
    if (!repoConfig.repoUrl) return;
    setAnalyzingRepo(true);
    setAnalysisNote(null);

    try {
      const res = await fetch('/api/repo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoConfig.repoUrl, branch: repoConfig.branch }),
      });
      const data = await res.json();
      if (data.success) {
        setRepoConfig((prev) => ({
          ...prev,
          branch: data.branch || prev.branch,
          projectType: data.detectedType || prev.projectType,
          appPort: data.suggestedPort || prev.appPort,
          buildCommand: data.buildCommand || prev.buildCommand,
          startCommand: data.startCommand || prev.startCommand,
          envVars: data.envVarsTemplate ? data.envVarsTemplate : prev.envVars,
        }));
        setAnalysisNote(
          `✓ Δημόσιο αποθετήριο: ${data.repo} (Branch: ${data.branch || 'main'}) · ${data.description || 'Αναγνωρίστηκε επιτυχώς'}${
            data.envVarsTemplate ? ' · Φορτώθηκε το πρότυπο .env' : ''
          }`
        );
      } else {
        setAnalysisNote(data.message || 'Αποτυχία ανάλυσης');
      }
    } catch (err: any) {
      setAnalysisNote(`Σφάλμα: ${err.message}`);
    } finally {
      setAnalyzingRepo(false);
    }
  };

  // Test VPS SSH Connection
  const handleTestVps = async () => {
    if (!vpsConfig.host || (!vpsConfig.password && !vpsConfig.privateKey)) return;
    setTestingConnection(true);
    setVpsConnectionResult(null);

    try {
      const res = await fetch('/api/vps/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: vpsConfig.host,
          port: vpsConfig.port,
          username: vpsConfig.username,
          password: vpsConfig.authType === 'password' ? vpsConfig.password : undefined,
          privateKey: vpsConfig.authType === 'privateKey' ? vpsConfig.privateKey : undefined,
        }),
      });
      const data = await res.json();
      setVpsConnectionResult({
        success: data.success,
        message: data.message,
        diagnostics: data.diagnostics,
      });
    } catch (err: any) {
      setVpsConnectionResult({
        success: false,
        message: `Σφάλμα σύνδεσης: ${err.message}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Check Domain DNS
  const handleCheckDns = async () => {
    if (!domainConfig.domain) return;
    setCheckingDns(true);
    setDnsResult(null);

    try {
      const res = await fetch('/api/dns/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainConfig.domain,
          expectedIp: vpsConfig.host,
        }),
      });
      const data = await res.json();
      setDnsResult(data);
    } catch (err: any) {
      setDnsResult({ message: `Σφάλμα DNS: ${err.message}` });
    } finally {
      setCheckingDns(false);
    }
  };

  // Execute Live Deployment
  const handleStartDeployment = async () => {
    setIsDeploying(true);
    setDeploySuccess(false);
    setLiveUrl(null);
    setLogs([]);
    setActiveStepProgress(1);

    // Automatically persist the current VPS & SSL defaults
    handleSaveSettings();

    const cleanDomain = domainConfig.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    const finalDeployPath = repoConfig.deployPath || `/var/www/${cleanDomain}`;

    try {
      const response = await fetch('/api/deploy/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vps: vpsConfig,
          repoUrl: repoConfig.repoUrl,
          branch: repoConfig.branch,
          domain: cleanDomain,
          appPort: repoConfig.appPort,
          deployPath: finalDeployPath,
          projectType: repoConfig.projectType,
          buildCommand: repoConfig.buildCommand,
          startCommand: repoConfig.startCommand,
          envVars: repoConfig.envVars,
          enableSsl: domainConfig.enableSsl,
          email: domainConfig.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Αποτυχία έναρξης deployment');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Δεν ήταν δυνατή η ανάγνωση του stream καταγραφής');
      }

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));

              if (eventData.type === 'completed') {
                if (eventData.success) {
                  setDeploySuccess(true);
                  setLiveUrl(eventData.url || `https://${cleanDomain}`);

                  // Save to projects
                  const newProject: DeploymentProject = {
                    id: initialProject?.id || 'proj_' + Date.now().toString(36),
                    name: cleanDomain || repoConfig.repoUrl.split('/').pop() || 'My App',
                    status: 'healthy',
                    lastDeployedAt: new Date().toISOString(),
                    vps: vpsConfig,
                    repo: { ...repoConfig, deployPath: finalDeployPath },
                    domain: domainConfig,
                    createdAt: initialProject?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };

                  fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProject),
                  }).catch(() => {});

                  onDeploymentComplete(newProject);
                } else {
                  setDeploySuccess(false);
                }
              } else {
                setLogs((prev) => [
                  ...prev,
                  {
                    id: 'log_' + Date.now() + Math.random(),
                    type: eventData.type,
                    message: eventData.message,
                    timestamp: eventData.timestamp || new Date().toISOString(),
                    step: eventData.step,
                  },
                ]);
                if (eventData.step) {
                  setActiveStepProgress(eventData.step);
                }
              }
            } catch (e) {
              console.error('Error parsing SSE event:', e);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          type: 'error',
          message: `Σφάλμα κατά την εκτέλεση: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setDeploySuccess(false);
    } finally {
      setIsDeploying(false);
    }
  };

  const openPreview = () => {
    const bashScript = buildBashScript(repoConfig, domainConfig, vpsConfig);
    const nginxConfig = buildNginxConfig(
      domainConfig.domain,
      repoConfig.appPort,
      repoConfig.projectType,
      repoConfig.deployPath || `/var/www/${domainConfig.domain}`
    );
    onOpenScriptModal(bashScript, nginxConfig, domainConfig.domain);
  };

  return (
    <div className="space-y-6">
      {/* Stepper Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-slate-800 pb-4">
        {[
          { step: 1, title: t.step1Title, desc: 'Repo & Build' },
          { step: 2, title: t.step2Title, desc: 'SSH Credentials' },
          { step: 3, title: t.step3Title, desc: 'Domain & SSL' },
          { step: 4, title: t.step4Title, desc: 'Deploy & Console' },
        ].map((item) => (
          <button
            key={item.step}
            onClick={() => setCurrentStep(item.step as any)}
            className={`text-left p-3 rounded-xl border transition-all ${
              currentStep === item.step
                ? 'bg-slate-900 border-emerald-500/40'
                : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  currentStep === item.step
                    ? 'bg-emerald-400 text-slate-950'
                    : currentStep > item.step
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {item.step}
              </span>
              <span className={`text-xs font-semibold ${currentStep === item.step ? 'text-white' : 'text-slate-400'}`}>
                {item.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pl-7">{item.desc}</p>
          </button>
        ))}
      </div>

      {/* STEP 1: Repository */}
      {currentStep === 1 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.step1Title}</h3>
                <p className="text-xs text-slate-400">{t.step1Desc}</p>
              </div>
            </div>

            <button
              onClick={openPreview}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{t.viewBashScript}</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              {t.quickPresets}
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    repoConfig.projectType === p.type
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* GitHub Repo URL & Branch */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.repoUrlLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={repoConfig.repoUrl}
                  onChange={(e) => setRepoConfig({ ...repoConfig, repoUrl: e.target.value })}
                  placeholder={t.repoUrlPlaceholder}
                  className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleAnalyzeRepo}
                  disabled={analyzingRepo || !repoConfig.repoUrl}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${analyzingRepo ? 'animate-spin' : ''}`} />
                  <span>{analyzingRepo ? t.analyzing : t.analyzeRepo}</span>
                </button>
              </div>
              {analysisNote && (
                <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {analysisNote}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.branchLabel}
              </label>
              <input
                type="text"
                value={repoConfig.branch}
                onChange={(e) => setRepoConfig({ ...repoConfig, branch: e.target.value })}
                placeholder="main"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Commands & Port */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.appPortLabel}
              </label>
              <input
                type="number"
                value={repoConfig.appPort}
                onChange={(e) => setRepoConfig({ ...repoConfig, appPort: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-1">Το port όπου ακούει η εφαρμογή σας (π.χ. 3000)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.buildCommandLabel}
              </label>
              <input
                type="text"
                value={repoConfig.buildCommand}
                onChange={(e) => setRepoConfig({ ...repoConfig, buildCommand: e.target.value })}
                placeholder="npm ci && npm run build"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.startCommandLabel}
              </label>
              <input
                type="text"
                value={repoConfig.startCommand}
                onChange={(e) => setRepoConfig({ ...repoConfig, startCommand: e.target.value })}
                placeholder="npm start"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Target Path */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t.deployPathLabel}
            </label>
            <input
              type="text"
              value={repoConfig.deployPath}
              onChange={(e) => setRepoConfig({ ...repoConfig, deployPath: e.target.value })}
              placeholder="/var/www/my-app"
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Environment Variables */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {t.envVarsLabel}
            </label>
            <textarea
              value={repoConfig.envVars}
              onChange={(e) => setRepoConfig({ ...repoConfig, envVars: e.target.value })}
              placeholder={t.envVarsPlaceholder}
              rows={4}
              className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>{t.next}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: VPS SSH Connection */}
      {currentStep === 2 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.step2Title}</h3>
                <p className="text-xs text-slate-400">{t.step2Desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ασφαλής απευθείας σύνδεση SSH</span>
            </div>
          </div>

          {/* Host, Port, Username */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.vpsHostLabel}
              </label>
              <input
                type="text"
                value={vpsConfig.host}
                onChange={(e) => setVpsConfig({ ...vpsConfig, host: e.target.value })}
                placeholder="π.χ. 185.122.54.10 ή vps.example.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.vpsPortLabel}
              </label>
              <input
                type="number"
                value={vpsConfig.port}
                onChange={(e) => setVpsConfig({ ...vpsConfig, port: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.vpsUserLabel}
              </label>
              <input
                type="text"
                value={vpsConfig.username}
                onChange={(e) => setVpsConfig({ ...vpsConfig, username: e.target.value })}
                placeholder="root"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {t.vpsAuthType}
            </label>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="authMethod"
                  checked={vpsConfig.authType === 'password'}
                  onChange={() => setVpsConfig({ ...vpsConfig, authType: 'password' })}
                  className="text-emerald-500"
                />
                <span className="text-slate-300 font-medium">{t.password}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="authMethod"
                  checked={vpsConfig.authType === 'privateKey'}
                  onChange={() => setVpsConfig({ ...vpsConfig, authType: 'privateKey' })}
                  className="text-emerald-500"
                />
                <span className="text-slate-300 font-medium">{t.privateKey}</span>
              </label>
            </div>

            {vpsConfig.authType === 'password' ? (
              <input
                type="password"
                value={vpsConfig.password}
                onChange={(e) => setVpsConfig({ ...vpsConfig, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            ) : (
              <textarea
                value={vpsConfig.privateKey}
                onChange={(e) => setVpsConfig({ ...vpsConfig, privateKey: e.target.value })}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                rows={4}
                className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestVps}
              disabled={testingConnection || !vpsConfig.host || (!vpsConfig.password && !vpsConfig.privateKey)}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? t.testingConnection : t.testConnection}</span>
            </button>

            {vpsConnectionResult && (
              <div
                className={`text-xs flex items-center gap-1.5 ${
                  vpsConnectionResult.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {vpsConnectionResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{vpsConnectionResult.message}</span>
              </div>
            )}
          </div>

          {/* Persistence Card */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookmarkCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Μόνιμη αποθήκευση στοιχείων VPS &amp; SSL
                  </span>
                  {hasSavedDefaults && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                      Αποθηκευμένα
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  Απομνημονεύει την IP, το χρήστη και τον κωδικό ώστε να μην τα ξαναγράφετε ποτέ σε μελλοντικές αναπτύξεις.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveFeedback || 'Αποθήκευση ως Μόνιμα'}</span>
              </button>
              {hasSavedDefaults && (
                <button
                  type="button"
                  onClick={handleClearSettings}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors px-1"
                >
                  Καθαρισμός
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.back}</span>
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>{t.next}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Domain, Proxy & SSL */}
      {currentStep === 3 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.step3Title}</h3>
                <p className="text-xs text-slate-400">{t.step3Desc}</p>
              </div>
            </div>

            <button
              onClick={openPreview}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{t.viewNginxConfig}</span>
            </button>
          </div>

          {/* Domain Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.domainLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainConfig.domain}
                  onChange={(e) => setDomainConfig({ ...domainConfig, domain: e.target.value })}
                  placeholder={t.domainPlaceholder}
                  className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleCheckDns}
                  disabled={checkingDns || !domainConfig.domain}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingDns ? 'animate-spin' : ''}`} />
                  <span>{checkingDns ? 'Έλεγχος...' : t.checkDns}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.sslEmailLabel}
              </label>
              <input
                type="email"
                value={domainConfig.email}
                onChange={(e) => setDomainConfig({ ...domainConfig, email: e.target.value })}
                placeholder="admin@mydomain.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* DNS verification feedback */}
          {dnsResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                dnsResult.matches
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {dnsResult.matches ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-semibold">{dnsResult.message}</span>
              </div>
            </div>
          )}

          {/* SSL Toggle */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={domainConfig.enableSsl}
                onChange={(e) => setDomainConfig({ ...domainConfig, enableSsl: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded text-emerald-500 focus:ring-emerald-400"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  {t.enableSsl}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Εγκαθιστά αυτόματα δωρεάν πιστοποιητικό Let's Encrypt με Certbot και ανακατεύθυνση HTTP σε HTTPS.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.back}</span>
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>{t.next}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Deploy & Live Terminal */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-medium">Σύνοψη Ανάπτυξης</span>
                <div className="flex items-center gap-3 text-sm text-white font-bold">
                  <span className="font-mono text-emerald-400">{domainConfig.domain}</span>
                  <span className="text-slate-500 font-normal">→</span>
                  <span className="font-mono text-slate-300">{vpsConfig.host}</span>
                  <span className="text-slate-500 font-normal">→</span>
                  <span className="text-xs text-slate-400 font-normal">
                    {repoConfig.projectType.toUpperCase()} (Port {repoConfig.appPort})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={openPreview}
                  className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Προεπισκόπηση Script</span>
                </button>

                <button
                  onClick={handleStartDeployment}
                  disabled={isDeploying || !vpsConfig.host}
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                >
                  <Play className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : ''}`} />
                  <span>{isDeploying ? t.deploying : t.deployNow}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {deploySuccess && liveUrl && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 text-emerald-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-base font-bold text-white">Η εφαρμογή σας είναι Live!</h4>
                    <p className="text-xs text-emerald-300/80 mt-0.5">
                      Η ανάπτυξη ολοκληρώθηκε επιτυχώς, το Nginx ρυθμίστηκε και το domain απαντά.
                    </p>
                  </div>
                </div>

                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span>Άνοιγμα Ιστοσελίδας</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Terminal Console */}
          <TerminalConsole
            logs={logs}
            isDeploying={isDeploying}
            onClearLogs={() => setLogs([])}
            title={`${domainConfig.domain} Deployment Logs`}
          />

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.back}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
