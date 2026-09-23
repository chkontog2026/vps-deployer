/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DeployWizard } from './components/DeployWizard';
import { ProjectList } from './components/ProjectList';
import { VpsDoctorModal } from './components/VpsDoctorModal';
import { DnsChecker } from './components/DnsChecker';
import { ScriptViewerModal } from './components/ScriptViewerModal';
import { DeploymentProject } from './types';
import { Language, translations } from './lib/translations';
import {
  Server,
  Github,
  Globe,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'wizard' | 'projects' | 'doctor' | 'dns'>('wizard');
  const [language, setLanguage] = useState<Language>('el');
  const [projects, setProjects] = useState<DeploymentProject[]>([]);
  const [selectedProjectForRedeploy, setSelectedProjectForRedeploy] = useState<DeploymentProject | null>(null);

  // Script Modal state
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [modalBashScript, setModalBashScript] = useState('');
  const [modalNginxConfig, setModalNginxConfig] = useState('');
  const [modalDomain, setModalDomain] = useState('');

  const t = translations[language];

  // Load existing projects from server
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.projects)) {
          setProjects(data.projects);
        }
      })
      .catch(() => {});
  }, []);

  const handleDeploymentComplete = (project: DeploymentProject) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = project;
        return copy;
      }
      return [project, ...prev];
    });
  };

  const handleRedeployProject = (project: DeploymentProject) => {
    setSelectedProjectForRedeploy(project);
    setCurrentTab('wizard');
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  const handleOpenScriptModal = (bash: string, nginx: string, domain: string) => {
    setModalBashScript(bash);
    setModalNginxConfig(nginx);
    setModalDomain(domain);
    setScriptModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'wizard' && currentTab !== 'wizard') {
            setSelectedProjectForRedeploy(null);
          }
          setCurrentTab(tab);
        }}
        language={language}
        onToggleLanguage={setLanguage}
        projectsCount={projects.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Subtle Architectural Flow Indicator (Only on Wizard tab) */}
        {currentTab === 'wizard' && (
          <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 shrink-0">
                  <Github className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">1. GitHub Repo</span>
                  <span className="text-slate-400">Clone &amp; Build</span>
                </div>
              </div>

              <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600" />

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 shrink-0">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">2. VPS Server</span>
                  <span className="text-slate-400">SSH &amp; Docker / PM2</span>
                </div>
              </div>

              <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600" />

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">3. Custom Domain</span>
                  <span className="text-slate-400">Nginx Reverse Proxy</span>
                </div>
              </div>

              <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600" />

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-emerald-400 block">4. Let's Encrypt</span>
                  <span className="text-slate-400">Automated SSL</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Switcher */}
        {currentTab === 'wizard' && (
          <DeployWizard
            key={selectedProjectForRedeploy?.id || 'new'}
            initialProject={selectedProjectForRedeploy}
            onDeploymentComplete={handleDeploymentComplete}
            language={language}
            onOpenScriptModal={handleOpenScriptModal}
          />
        )}

        {currentTab === 'projects' && (
          <ProjectList
            projects={projects}
            onSelectProject={handleRedeployProject}
            onRedeployProject={handleRedeployProject}
            onDeleteProject={handleDeleteProject}
            onOpenNewDeploy={() => {
              setSelectedProjectForRedeploy(null);
              setCurrentTab('wizard');
            }}
            onViewScript={(p) => {
              handleOpenScriptModal(
                `# Script for ${p.domain.domain}`,
                `# Nginx config for ${p.domain.domain}`,
                p.domain.domain
              );
            }}
            language={language}
          />
        )}

        {currentTab === 'doctor' && (
          <VpsDoctorModal
            vpsCredentials={selectedProjectForRedeploy?.vps}
            language={language}
          />
        )}

        {currentTab === 'dns' && (
          <DnsChecker
            initialDomain={selectedProjectForRedeploy?.domain.domain || ''}
            expectedIp={selectedProjectForRedeploy?.vps.host || ''}
            language={language}
          />
        )}
      </main>

      {/* Script & Config Modal */}
      <ScriptViewerModal
        isOpen={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        bashScript={modalBashScript}
        nginxConfig={modalNginxConfig}
        domain={modalDomain}
        language={language}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">ShipVPS</span>
            <span>·</span>
            <span>Zero-Downtime GitHub to VPS Automation</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setCurrentTab('doctor')}
              className="hover:text-slate-200 transition-colors"
            >
              VPS Doctor
            </button>
            <button
              onClick={() => setCurrentTab('dns')}
              className="hover:text-slate-200 transition-colors"
            >
              DNS Verifier
            </button>
            <button
              onClick={() => {
                setSelectedProjectForRedeploy(null);
                setCurrentTab('wizard');
              }}
              className="hover:text-slate-200 transition-colors"
            >
              Νέο Deployment
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
