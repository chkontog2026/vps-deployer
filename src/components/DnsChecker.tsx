import React, { useState } from 'react';
import { Globe, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Copy, Check } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface DnsCheckerProps {
  initialDomain?: string;
  expectedIp?: string;
  language: Language;
}

export const DnsChecker: React.FC<DnsCheckerProps> = ({
  initialDomain = '',
  expectedIp: propExpectedIp = '',
  language,
}) => {
  const t = translations[language];
  const [domain, setDomain] = useState(initialDomain);
  const [expectedIp, setExpectedIp] = useState(propExpectedIp);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    resolvedIps?: string[];
    matches?: boolean;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  // Extract host/subdomain: e.g. for "app.example.com" host is "app", for "example.com" host is "@"
  const parts = cleanDomain.split('.');
  const hostRecord = parts.length > 2 ? parts[0] : '@';

  const checkDns = async () => {
    if (!domain) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/dns/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain, expectedIp }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Αποτυχία εκτέλεσης ελέγχου DNS',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">DNS &amp; A-Record Verifier</h2>
          <p className="text-xs text-slate-400">
            {language === 'el'
              ? 'Ελέγξτε αν το domain σας δείχνει στη σωστή IP διεύθυνση του VPS πριν ενεργοποιήσετε το SSL'
              : 'Verify your domain points to your VPS IP before requesting Let\'s Encrypt SSL'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {t.domainLabel}
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="api.mydomain.com"
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {language === 'el' ? 'Αναμενόμενη IP του VPS' : 'Expected VPS IP'}
          </label>
          <input
            type="text"
            value={expectedIp}
            onChange={(e) => setExpectedIp(e.target.value)}
            placeholder="π.χ. 185.122.54.10"
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      <button
        onClick={checkDns}
        disabled={loading || !domain}
        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors rounded-lg flex items-center gap-2 mb-6"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        <span>{loading ? 'Έλεγχος DNS σε εξέλιξη...' : t.checkDns}</span>
      </button>

      {/* Required DNS settings table */}
      {domain && (
        <div className="mb-6 p-4 bg-slate-950/80 border border-slate-800 rounded-lg">
          <p className="text-xs font-medium text-slate-300 mb-2">
            {t.dnsInstructions}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 text-left">
                  <th className="py-1.5 px-3">Type</th>
                  <th className="py-1.5 px-3">Name / Host</th>
                  <th className="py-1.5 px-3">Value / Target IP</th>
                  <th className="py-1.5 px-3">TTL</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                <tr className="border-b border-slate-900">
                  <td className="py-2 px-3 text-emerald-400 font-bold">A</td>
                  <td className="py-2 px-3 flex items-center gap-1.5">
                    <span>{hostRecord}</span>
                    <button
                      onClick={() => copyText(hostRecord, 'host')}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      {copied === 'host' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span>{expectedIp || 'Η IP του VPS σας'}</span>
                      {expectedIp && (
                        <button
                          onClick={() => copyText(expectedIp, 'ip')}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {copied === 'ip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-slate-400">Auto / 300s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div
          className={`p-4 rounded-lg border text-xs ${
            result.matches
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {result.matches ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold text-sm mb-1">{result.message}</p>
              {result.resolvedIps && result.resolvedIps.length > 0 && (
                <div className="text-slate-300 mt-2 space-y-0.5">
                  <p>
                    {language === 'el' ? 'Τρέχουσες IPs που επιλύονται:' : 'Currently resolved IPs:'}{' '}
                    <span className="font-mono text-white">{result.resolvedIps.join(', ')}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
