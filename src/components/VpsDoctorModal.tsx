import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, Copy, Check, Terminal, Play, Wrench } from 'lucide-react';
import { VpsCredentials, VpsDiagnostics } from '../types';
import { Language, translations } from '../lib/translations';

interface VpsDoctorModalProps {
  vpsCredentials?: VpsCredentials;
  language: Language;
}

export const VpsDoctorModal: React.FC<VpsDoctorModalProps> = ({
  vpsCredentials,
  language,
}) => {
  const t = translations[language];
  const [host, setHost] = useState(vpsCredentials?.host || '');
  const [port, setPort] = useState(vpsCredentials?.port || 22);
  const [username, setUsername] = useState(vpsCredentials?.username || 'root');
  const [password, setPassword] = useState(vpsCredentials?.password || '');
  const [privateKey, setPrivateKey] = useState(vpsCredentials?.privateKey || '');
  const [authType, setAuthType] = useState<'password' | 'privateKey'>(
    vpsCredentials?.authType || 'password'
  );

  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<VpsDiagnostics | null>(null);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [copiedScript, setCopiedScript] = useState(false);

  const bootstrapScript = `#!/usr/bin/env bash
# VPS Fast Bootstrap Script for ShipVPS
set -e
echo "Updating packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

echo "Installing essential tools (Git, Curl, UFW, Nginx, Certbot)..."
sudo apt-get install -y git curl wget ufw nginx certbot python3-certbot-nginx

echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable || true

echo "Installing Docker & Docker Compose..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER || true

echo "Installing Node.js 20 LTS & PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

echo "Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "VPS is now fully configured and ready for deployments!"
`;

  const runDiagnostics = async () => {
    setLoading(true);
    setStatusMessage('');
    setDiagnostics(null);
    setRawOutput('');

    try {
      const res = await fetch('/api/vps/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port,
          username,
          password: authType === 'password' ? password : '',
          privateKey: authType === 'privateKey' ? privateKey : '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDiagnostics(data.diagnostics);
        setRawOutput(data.rawOutput || '');
        setStatusMessage(data.message || 'Επιτυχής έλεγχος διακομιστή!');
      } else {
        setStatusMessage(`Σφάλμα: ${data.message}`);
      }
    } catch (err: any) {
      setStatusMessage(`Αποτυχία σύνδεσης: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyBootstrap = () => {
    navigator.clipboard.writeText(bootstrapScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">VPS Health Check &amp; Prerequisites Doctor</h2>
            <p className="text-xs text-slate-400">
              {language === 'el'
                ? 'Ελέγξτε αν ο server σας έχει εγκατεστημένα τα απαραίτητα πακέτα (Git, Docker, Nginx, Certbot, Node.js)'
                : 'Diagnose your server dependencies and bootstrap required software'}
            </p>
          </div>
        </div>

        {/* Input credentials for doctor check */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Host / IP
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="π.χ. 185.122.54.10"
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              SSH Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              User
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="doctorAuth"
                checked={authType === 'password'}
                onChange={() => setAuthType('password')}
                className="text-emerald-500"
              />
              <span className="text-slate-300">Password</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="doctorAuth"
                checked={authType === 'privateKey'}
                onChange={() => setAuthType('privateKey')}
                className="text-emerald-500"
              />
              <span className="text-slate-300">SSH Private Key</span>
            </label>
          </div>

          {authType === 'password' ? (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
            />
          ) : (
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              rows={3}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
            />
          )}
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading || !host || (!password && !privateKey)}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-2"
        >
          <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Διαγνωστικός έλεγχος σε εξέλιξη...' : 'Εκτέλεση Διαγνωστικών VPS'}</span>
        </button>

        {statusMessage && (
          <p className="mt-3 text-xs text-slate-300">{statusMessage}</p>
        )}

        {/* Diagnostics Results */}
        {diagnostics && (
          <div className="mt-6 border-t border-slate-800 pt-5">
            <h3 className="text-sm font-bold text-white mb-3">Αποτελέσματα Ελέγχου Διακομιστή</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { name: 'Git', installed: diagnostics.git },
                { name: 'Docker', installed: diagnostics.docker },
                { name: 'Nginx', installed: diagnostics.nginx },
                { name: 'Certbot (SSL)', installed: diagnostics.certbot },
                { name: 'Node.js', installed: diagnostics.node },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className={`p-3 rounded-lg border text-center ${
                    tool.installed
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex justify-center mb-1">
                    {tool.installed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                  <span className="text-xs font-bold">{tool.name}</span>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    {tool.installed ? 'Εγκατεστημένο' : 'Δεν βρέθηκε'}
                  </p>
                </div>
              ))}
            </div>

            {rawOutput && (
              <div className="mt-4 p-3 bg-black/70 border border-slate-800 rounded-lg text-slate-400 text-xs font-mono max-h-36 overflow-y-auto whitespace-pre-wrap">
                {rawOutput}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1-Click Bootstrap Script */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              {language === 'el' ? 'Έτοιμο Script Εγκατάστασης (One-Click VPS Setup)' : 'Quick VPS Bootstrap Script'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'el'
                ? 'Εάν έχετε καινούριο VPS (Ubuntu/Debian), τρέξτε αυτό το script για να εγκατασταθούν όλα αυτόματα σε 1 λεπτό'
                : 'Run this once on a clean Ubuntu/Debian VPS to install all requirements'}
            </p>
          </div>
          <button
            onClick={copyBootstrap}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedScript ? t.copied : t.copy}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs font-mono overflow-x-auto max-h-56">
          {bootstrapScript}
        </pre>
      </div>
    </div>
  );
};
