import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  GitBranch,
  Server,
  RefreshCw,
  Trash2,
  FileCode,
  Link2,
  Check,
  Activity,
  Layers,
  Clock,
} from 'lucide-react';
import { DeploymentProject } from '../types';
import { Language, translations } from '../lib/translations';

interface ProjectListProps {
  projects: DeploymentProject[];
  onSelectProject: (project: DeploymentProject) => void;
  onRedeployProject: (project: DeploymentProject) => void;
  onDeleteProject: (id: string) => void;
  onOpenNewDeploy: () => void;
  onViewScript: (project: DeploymentProject) => void;
  language: Language;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onSelectProject,
  onRedeployProject,
  onDeleteProject,
  onOpenNewDeploy,
  onViewScript,
  language,
}) => {
  const t = translations[language];
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<{
    [id: string]: { online: boolean; statusCode?: number; latencyMs?: number; message?: string };
  }>({});

  const copyWebhook = (projectId: string) => {
    const origin = window.location.origin;
    const webhookUrl = `${origin}/api/webhook/${projectId}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const pingDomain = async (project: DeploymentProject) => {
    const cleanDomain = project.domain.domain;
    if (!cleanDomain) return;

    setPingingId(project.id);
    try {
      const res = await fetch('/api/domain/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain }),
      });
      const data = await res.json();
      setPingResults((prev) => ({
        ...prev,
        [project.id]: {
          online: data.online,
          statusCode: data.statusCode,
          latencyMs: data.latencyMs,
          message: data.message,
        },
      }));
    } catch (err: any) {
      setPingResults((prev) => ({
        ...prev,
        [project.id]: {
          online: false,
          message: err.message,
        },
      }));
    } finally {
      setPingingId(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{t.noProjectsYet}</h3>
        <p className="text-sm text-slate-400 mb-6">
          {language === 'el'
            ? 'Συνδέστε το GitHub αποθετήριό σας, ορίστε το VPS σας και σηκώστε την εφαρμογή σας σε ένα custom domain με αυτόματο SSL σε λιγότερο από 3 λεπτά.'
            : 'Connect your GitHub repository, configure your VPS, and deploy to your custom domain with automated SSL in under 3 minutes.'}
        </p>
        <button
          onClick={onOpenNewDeploy}
          className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <span>{t.startFirstDeploy}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t.projects}</h2>
          <p className="text-xs text-slate-400">
            {language === 'el'
              ? 'Διαχείριση των ενεργών εφαρμογών που έχουν αναπτυχθεί στους VPS servers σας'
              : 'Manage deployed applications running on your VPS servers'}
          </p>
        </div>
        <button
          onClick={onOpenNewDeploy}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span>{t.newDeployment}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {projects.map((p) => {
          const ping = pingResults[p.id];
          const cleanDomain = p.domain.domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          const siteUrl = `https://${cleanDomain}`;

          return (
            <div
              key={p.id}
              className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all rounded-xl p-5"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* App Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-white hover:text-emerald-400 transition-colors">
                      {p.name || cleanDomain || 'Unnamed Project'}
                    </span>
                    {/* Project Type Text Metadata */}
                    <span className="text-xs text-slate-400 font-mono">
                      · {p.repo.projectType.toUpperCase()} · Port {p.repo.appPort}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    {/* Domain Link */}
                    <div className="flex items-center gap-1 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-emerald-300 underline font-mono flex items-center gap-1"
                      >
                        {cleanDomain}
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    </div>

                    {/* Repo Link */}
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-slate-300 truncate max-w-[200px]">
                        {p.repo.repoUrl.replace('https://github.com/', '')}
                      </span>
                      <span className="text-slate-500">({p.repo.branch})</span>
                    </div>

                    {/* VPS Host */}
                    <div className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-slate-300">{p.vps.host}</span>
                    </div>

                    {/* Last Deployed Time */}
                    {p.lastDeployedAt && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="tabular-nums">
                          {new Date(p.lastDeployedAt).toLocaleDateString()} {new Date(p.lastDeployedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Health & Actions */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {/* Ping Status */}
                  <button
                    onClick={() => pingDomain(p)}
                    disabled={pingingId === p.id}
                    className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    title="Εξακρίβωση απόκρισης domain"
                  >
                    <Activity className={`w-3.5 h-3.5 ${pingingId === p.id ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                    {ping ? (
                      ping.online ? (
                        <span className="text-emerald-400 font-medium tabular-nums">
                          Online ({ping.latencyMs}ms)
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium">Offline</span>
                      )
                    ) : (
                      <span>Health Check</span>
                    )}
                  </button>

                  {/* Webhook Copy */}
                  <button
                    onClick={() => copyWebhook(p.id)}
                    className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    title={t.webhookDesc}
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Webhook Copied</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Webhook</span>
                      </>
                    )}
                  </button>

                  {/* View Script */}
                  <button
                    onClick={() => onViewScript(p)}
                    className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    title="View deploy.sh script & Nginx config"
                  >
                    <FileCode className="w-4 h-4" />
                  </button>

                  {/* Redeploy Button */}
                  <button
                    onClick={() => onRedeployProject(p)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.redeploy}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => onDeleteProject(p.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors"
                    title="Διαγραφή έργου"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
