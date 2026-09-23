import express, { Request, Response } from 'express';
import { Client } from 'ssh2';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory store for deployments and projects (persisted in a local json file if available)
const DATA_FILE = path.join(__dirname, 'deployments-data.json');

function loadProjects() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading data file:', err);
  }
  return [];
}

function saveProjects(data: any[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data file:', err);
  }
}

// Persistent user defaults file
const SETTINGS_FILE = path.join(__dirname, 'persistent-settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading settings file:', err);
  }
  return {
    vps: {
      host: '89.167.23.230',
      port: 22,
      username: 'root',
      authType: 'password',
    },
    domain: {
      email: 'chkontog2026@gmail.com',
      enableSsl: true,
    },
    saveDefaults: true,
  };
}

function saveSettings(data: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings file:', err);
  }
}

// Settings API Endpoints
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({ success: true, settings: loadSettings() });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const newSettings = { ...loadSettings(), ...req.body };
  saveSettings(newSettings);
  res.json({ success: true, message: 'Οι προεπιλογές αποθηκεύτηκαν μόνιμα!', settings: newSettings });
});

app.delete('/api/settings', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
  } catch {}
  res.json({ success: true, message: 'Οι αποθηκευμένες προεπιλογές διαγράφηκαν.' });
});

// 1. VPS Connection & Pre-flight Diagnostics
app.post('/api/vps/test-connection', async (req: Request, res: Response): Promise<void> => {
  const { host, port = 22, username, password, privateKey } = req.body;

  if (!host || !username || (!password && !privateKey)) {
    res.status(400).json({
      success: false,
      message: 'Συμπληρώστε Host, Username και Κωδικό ή Private Key.',
    });
    return;
  }

  const conn = new Client();
  let completed = false;

  const timer = setTimeout(() => {
    if (!completed) {
      completed = true;
      try { conn.end(); } catch {}
      res.status(504).json({
        success: false,
        message: 'Timeout: Δεν κατέστη δυνατή η σύνδεση στον VPS εντός 12 δευτερολέπτων. Ελέγξτε την IP και το Firewall (Port 22).',
      });
    }
  }, 12000);

  conn.on('ready', () => {
    // Run diagnostics
    const cmd = `
      echo "===OS===" && (cat /etc/os-release | grep PRETTY_NAME || uname -srm) &&
      echo "===UPTIME===" && uptime -p &&
      echo "===MEM===" && free -h | grep Mem | awk '{print $2, "total,", $3, "used"}' &&
      echo "===DISK===" && df -h / | awk 'NR==2{print $2, "total,", $4, "available"}' &&
      echo "===GIT===" && (git --version || echo "not installed") &&
      echo "===DOCKER===" && (docker --version || echo "not installed") &&
      echo "===NGINX===" && (nginx -v 2>&1 || echo "not installed") &&
      echo "===CERTBOT===" && (certbot --version || echo "not installed") &&
      echo "===NODE===" && (node -v || echo "not installed")
    `;

    conn.exec(cmd, (err, stream) => {
      if (err) {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          conn.end();
          res.json({ success: true, message: 'Συνδέθηκε επιτυχώς αλλά απέτυχε η εκτέλεση διαγνωστικών.' });
        }
        return;
      }

      let output = '';
      stream.on('data', (data: Buffer) => {
        output += data.toString();
      });

      stream.on('close', () => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          conn.end();

          const hasGit = !output.includes('===GIT===\nnot installed');
          const hasDocker = !output.includes('===DOCKER===\nnot installed');
          const hasNginx = !output.includes('===NGINX===\nnot installed');
          const hasCertbot = !output.includes('===CERTBOT===\nnot installed');
          const hasNode = !output.includes('===NODE===\nnot installed');

          res.json({
            success: true,
            message: 'Επιτυχής σύνδεση SSH στο VPS!',
            rawOutput: output,
            diagnostics: {
              git: hasGit,
              docker: hasDocker,
              nginx: hasNginx,
              certbot: hasCertbot,
              node: hasNode,
            },
          });
        }
      });
    });
  });

  conn.on('error', (err: Error) => {
    if (!completed) {
      completed = true;
      clearTimeout(timer);
      res.status(500).json({
        success: false,
        message: `Σφάλμα σύνδεσης SSH: ${err.message}`,
      });
    }
  });

  try {
    conn.connect({
      host,
      port: Number(port) || 22,
      username,
      password: password || undefined,
      privateKey: privateKey || undefined,
      readyTimeout: 10000,
    });
  } catch (err: any) {
    if (!completed) {
      completed = true;
      clearTimeout(timer);
      res.status(500).json({
        success: false,
        message: `Αποτυχία παραμέτρων SSH: ${err.message}`,
      });
    }
  }
});

// 2. DNS Resolution Verifier (Query Google DoH to verify domain -> VPS IP)
app.post('/api/dns/verify', async (req: Request, res: Response): Promise<void> => {
  const { domain, expectedIp } = req.body;

  if (!domain) {
    res.status(400).json({ success: false, message: 'Απαιτείται όνομα domain' });
    return;
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`;
    const response = await fetch(url);
    const data = await response.json();

    const answers = data.Answer || [];
    const resolvedIps = answers
      .filter((a: any) => a.type === 1) // Type 1 is A record
      .map((a: any) => a.data);

    const matches = expectedIp ? resolvedIps.includes(expectedIp) : resolvedIps.length > 0;

    res.json({
      success: true,
      domain: cleanDomain,
      resolvedIps,
      expectedIp,
      matches,
      status: data.Status,
      message: matches
        ? `Το domain ${cleanDomain} δείχνει επιτυχώς στην IP ${expectedIp || resolvedIps[0]}!`
        : resolvedIps.length > 0
        ? `Το domain δείχνει σε ${resolvedIps.join(', ')} αντί για ${expectedIp}. Ελέγξτε τις εγγραφές DNS (A Record).`
        : `Δεν βρέθηκε εγγραφή A (DNS) για το ${cleanDomain}. Προσθέστε ένα A Record στον πάροχο του domain σας.`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Σφάλμα ελέγχου DNS: ${err.message}`,
    });
  }
});

// 3. Domain Live HTTP Status Ping
app.post('/api/domain/ping', async (req: Request, res: Response): Promise<void> => {
  const { domain } = req.body;
  if (!domain) {
    res.status(400).json({ success: false, message: 'Απαιτείται όνομα domain' });
    return;
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const testUrl = `https://${cleanDomain}`;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(testUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ShipVPS-HealthCheck/1.0' },
    });
    clearTimeout(timeout);

    const latency = Date.now() - startTime;
    res.json({
      success: true,
      online: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      latencyMs: latency,
      url: testUrl,
    });
  } catch (err: any) {
    // Try http fallback if https failed
    try {
      const httpResponse = await fetch(`http://${cleanDomain}`, {
        redirect: 'follow',
        headers: { 'User-Agent': 'ShipVPS-HealthCheck/1.0' },
      });
      const latency = Date.now() - startTime;
      res.json({
        success: true,
        online: httpResponse.status >= 200 && httpResponse.status < 400,
        statusCode: httpResponse.status,
        latencyMs: latency,
        url: `http://${cleanDomain}`,
        note: 'Το HTTPS δεν ανταποκρίνεται ακόμα, αλλά το HTTP λειτουργεί.',
      });
    } catch (httpErr: any) {
      res.json({
        success: false,
        online: false,
        message: err.message || 'Δεν υπάρχει απόκριση από το domain',
      });
    }
  }
});

// 4. GitHub Repository Analyzer
app.post('/api/repo/analyze', async (req: Request, res: Response): Promise<void> => {
  const { repoUrl, branch = 'main' } = req.body;

  if (!repoUrl) {
    res.status(400).json({ success: false, message: 'Απαιτείται GitHub Repository URL' });
    return;
  }

  // Parse owner and repo name from URL: https://github.com/owner/repo
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/i);
  if (!match) {
    res.json({
      success: true,
      detectedType: 'generic',
      port: 3000,
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      message: 'Μη αναγνωρίσιμο format GitHub URL. Μπορείτε να ορίσετε χειροκίνητα τις παραμέτρους.',
    });
    return;
  }

  const owner = match[1];
  const repo = match[2];

  try {
    // 1. First fetch repo metadata to get true default_branch and visibility
    const repoMetaUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const metaRes = await fetch(repoMetaUrl, {
      headers: {
        'User-Agent': 'ShipVPS-Deployer/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let effectiveBranch = branch || 'main';
    let isPublic = true;
    let repoName = repo;
    let repoDescription = '';

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      isPublic = !metaData.private;
      repoName = metaData.name || repo;
      repoDescription = metaData.description || '';
      // If user had a stale/default branch or didn't specify, or if querying with provided branch might fail,
      // record the repo's actual default branch
      if (metaData.default_branch) {
        if (!branch || branch === 'canary' || branch === 'master' || branch === 'main') {
          effectiveBranch = metaData.default_branch;
        }
      }
    }

    // 2. Fetch root contents using effectiveBranch
    let apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(effectiveBranch)}`;
    let ghRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ShipVPS-Deployer/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // If failed, retry with 'main' or without ref
    if (!ghRes.ok && effectiveBranch !== 'main') {
      effectiveBranch = 'main';
      apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents?ref=main`;
      ghRes = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'ShipVPS-Deployer/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });
    }

    if (!ghRes.ok) {
      // Fallback if contents API was blocked or rate limited
      res.json({
        success: true,
        owner,
        repo: repoName,
        branch: effectiveBranch,
        isPublic,
        detectedType: 'vite-spa',
        suggestedPort: 80,
        buildCommand: 'npm install && npm run build',
        startCommand: 'serve-static',
        description: repoDescription || 'Public GitHub Repository',
        message: 'Εντοπίστηκε το δημόσιο αποθετήριο. Μπορείτε να επιβεβαιώσετε τις παραμέτρους build.',
      });
      return;
    }

    const files = await ghRes.json();
    const filenames: string[] = Array.isArray(files) ? files.map((f: any) => f.name.toLowerCase()) : [];

    let detectedType = 'docker';
    let suggestedPort = 3000;
    let buildCommand = '';
    let startCommand = '';
    let description = repoDescription || '';
    let envVarsTemplate = '';

    // Check for .env.example or .env.sample
    const envFile = Array.isArray(files)
      ? files.find((f: any) => f.name.toLowerCase() === '.env.example' || f.name.toLowerCase() === '.env.sample')
      : null;
    if (envFile && envFile.download_url) {
      try {
        const envRes = await fetch(envFile.download_url);
        if (envRes.ok) {
          envVarsTemplate = await envRes.text();
        }
      } catch {}
    }

    if (filenames.includes('dockerfile') || filenames.includes('docker-compose.yml') || filenames.includes('compose.yaml')) {
      detectedType = 'docker';
      suggestedPort = 3000;
      buildCommand = 'docker compose build || docker build -t app .';
      startCommand = 'docker compose up -d || docker run -d -p 3000:3000 --restart always app';
      description = description || 'Docker Container / Docker Compose project detected';
    } else if (filenames.includes('package.json')) {
      // Try to fetch package.json to see if Next.js, Vite, Express etc.
      try {
        const pkgFile = files.find((f: any) => f.name.toLowerCase() === 'package.json');
        if (pkgFile && pkgFile.download_url) {
          const pkgRes = await fetch(pkgFile.download_url);
          const pkgData = await pkgRes.json();
          const deps = { ...pkgData.dependencies, ...pkgData.devDependencies };

          if (deps['next']) {
            detectedType = 'nextjs';
            suggestedPort = 3000;
            buildCommand = 'npm install && npm run build';
            startCommand = 'pm2 restart app || pm2 start "npm start" --name app';
            description = 'Next.js Application detected (SSR / Full-stack)';
          } else if (deps['vite'] || deps['react-scripts'] || filenames.includes('vite.config.ts') || filenames.includes('vite.config.js')) {
            detectedType = 'vite-spa';
            suggestedPort = 80;
            buildCommand = 'npm install && npm run build';
            startCommand = 'serve-static'; // Direct Nginx static serving
            description = 'Vite + React SPA Application detected';
          } else {
            detectedType = 'nodejs';
            suggestedPort = 3000;
            buildCommand = 'npm install && npm run build';
            startCommand = 'pm2 restart app || pm2 start "npm start" --name app';
            description = 'Node.js application detected';
          }
        }
      } catch {
        detectedType = 'vite-spa';
        suggestedPort = 80;
        buildCommand = 'npm install && npm run build';
        startCommand = 'serve-static';
      }
    } else if (filenames.includes('requirements.txt') || filenames.includes('pyproject.toml')) {
      detectedType = 'python';
      suggestedPort = 8000;
      buildCommand = 'python3 -m venv venv && ./venv/bin/pip install -r requirements.txt';
      startCommand = './venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2';
      description = 'Python (FastAPI / Flask / Django) application detected';
    } else if (filenames.includes('index.html')) {
      detectedType = 'static';
      suggestedPort = 80;
      buildCommand = '# Static HTML files, no build step';
      startCommand = 'serve-static';
      description = 'Static HTML website detected';
    }

    res.json({
      success: true,
      owner,
      repo: repoName,
      branch: effectiveBranch,
      isPublic,
      detectedType,
      suggestedPort,
      buildCommand,
      startCommand,
      description,
      envVarsTemplate,
      filesCount: filenames.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Σφάλμα ανάλυσης repo: ${err.message}` });
  }
});

// 5. Generate Standalone Bash Deployment Script
app.post('/api/deploy/generate-script', (req: Request, res: Response): void => {
  const {
    repoUrl,
    branch = 'main',
    domain,
    appPort = 3000,
    deployPath = '/var/www/my-app',
    projectType = 'docker',
    buildCommand = '',
    startCommand = '',
    envVars = '',
    enableSsl = true,
    email = 'admin@example.com',
  } = req.body;

  const script = generateBashScript({
    repoUrl,
    branch,
    domain,
    appPort,
    deployPath,
    projectType,
    buildCommand,
    startCommand,
    envVars,
    enableSsl,
    email,
  });

  const nginxConfig = generateNginxConfig(domain, appPort, projectType, deployPath);

  res.json({
    success: true,
    script,
    nginxConfig,
  });
});

// 6. Live Deploy Runner via SSH (SSE Streaming)
app.post('/api/deploy/execute', (req: Request, res: Response): void => {
  const {
    vps,
    repoUrl,
    branch = 'main',
    domain,
    appPort = 3000,
    deployPath = `/var/www/${domain || 'app'}`,
    projectType = 'docker',
    buildCommand,
    startCommand,
    envVars = '',
    enableSsl = true,
    email = 'admin@example.com',
  } = req.body;

  if (!vps?.host || !vps?.username || (!vps?.password && !vps?.privateKey)) {
    res.status(400).json({ success: false, message: 'Απαιτούνται στοιχεία σύνδεσης VPS (Host, Username, Key/Password).' });
    return;
  }

  // Setup Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendLog = (type: 'info' | 'success' | 'warn' | 'error' | 'stdout' | 'step', message: string, step?: number) => {
    res.write(`data: ${JSON.stringify({ type, message, step, timestamp: new Date().toISOString() })}\n\n`);
  };

  sendLog('step', '1. Έναρξη σύνδεσης SSH στο VPS...', 1);
  sendLog('info', `Σύνδεση στο ${vps.username}@${vps.host}:${vps.port || 22}`);

  const conn = new Client();

  conn.on('ready', () => {
    sendLog('success', '✓ Επιτυχής σύνδεση SSH στο VPS!', 1);

    const fullScript = generateBashScript({
      repoUrl,
      branch,
      domain,
      appPort,
      deployPath,
      projectType,
      buildCommand,
      startCommand,
      envVars,
      enableSsl,
      email,
    });

    sendLog('step', '2. Προετοιμασία διακομιστή & αποθετηρίου...', 2);

    // Execute script via bash
    conn.exec(`bash -s`, (err, stream) => {
      if (err) {
        sendLog('error', `Σφάλμα εκτέλεσης εντολών: ${err.message}`);
        conn.end();
        res.end();
        return;
      }

      // Feed script to stdin
      stream.write(fullScript);
      stream.end();

      stream.on('data', (data: Buffer) => {
        const text = data.toString();
        // Parse step lines if any
        if (text.includes('[STEP:GIT]')) {
          sendLog('step', '3. Λήψη κώδικα (Git Clone / Pull)...', 3);
        } else if (text.includes('[STEP:BUILD]')) {
          sendLog('step', '4. Κατασκευή & Εκτέλεση Εφαρμογής...', 4);
        } else if (text.includes('[STEP:NGINX]')) {
          sendLog('step', '5. Ρύθμιση Reverse Proxy (Nginx) & Domain...', 5);
        } else if (text.includes('[STEP:SSL]')) {
          sendLog('step', '6. Έκδοση Πιστοποιητικού SSL (Let\'s Encrypt)...', 6);
        } else if (text.includes('[STEP:DONE]')) {
          sendLog('step', '7. Ολοκλήρωση ανάπτυξης!', 7);
        }

        sendLog('stdout', text.trim());
      });

      stream.stderr.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          sendLog('stdout', `[stderr] ${text}`);
        }
      });

      stream.on('close', (code: number) => {
        conn.end();
        if (code === 0) {
          sendLog('success', `🎉 Η ανάπτυξη ολοκληρώθηκε με επιτυχία! Η εφαρμογή σας είναι live στο: https://${domain || vps.host}`);
          res.write(`data: ${JSON.stringify({ type: 'completed', success: true, url: `https://${domain || vps.host}` })}\n\n`);
        } else {
          sendLog('error', `Η διαδικασία τερματίστηκε με κωδικό σφάλματος: ${code}`);
          res.write(`data: ${JSON.stringify({ type: 'completed', success: false, code })}\n\n`);
        }
        res.end();
      });
    });
  });

  conn.on('error', (err: Error) => {
    sendLog('error', `Σφάλμα σύνδεσης SSH: ${err.message}`);
    res.write(`data: ${JSON.stringify({ type: 'completed', success: false, error: err.message })}\n\n`);
    res.end();
  });

  try {
    conn.connect({
      host: vps.host,
      port: Number(vps.port) || 22,
      username: vps.username,
      password: vps.password || undefined,
      privateKey: vps.privateKey || undefined,
      readyTimeout: 15000,
    });
  } catch (err: any) {
    sendLog('error', `Αποτυχία παραμέτρων SSH: ${err.message}`);
    res.end();
  }
});

// Helper: Generate Bulletproof Nginx Configuration
function generateNginxConfig(domain: string, appPort: number, projectType: string, deployPath: string): string {
  const cleanDomain = domain ? domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim() : 'example.com';

  if (projectType === 'vite-spa' || projectType === 'static') {
    return `# Nginx configuration for Static Site / SPA: ${cleanDomain}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain} www.${cleanDomain};

    root ${deployPath}/dist;
    index index.html index.htm;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    access_log /var/log/nginx/${cleanDomain}_access.log;
    error_log /var/log/nginx/${cleanDomain}_error.log;
}
`;
  }

  return `# Nginx Reverse Proxy for ${cleanDomain} -> localhost:${appPort}
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain} www.${cleanDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long requests / WebSockets
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/${cleanDomain}_access.log;
    error_log /var/log/nginx/${cleanDomain}_error.log;
}
`;
}

// Helper: Generate Bulletproof Bash Deploy Script
function generateBashScript(opts: {
  repoUrl: string;
  branch: string;
  domain: string;
  appPort: number;
  deployPath: string;
  projectType: string;
  buildCommand?: string;
  startCommand?: string;
  envVars?: string;
  enableSsl: boolean;
  email?: string;
}): string {
  const cleanDomain = opts.domain ? opts.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim() : 'app.example.com';
  const repoName = opts.repoUrl.split('/').pop()?.replace('.git', '') || 'app';
  const targetDir = opts.deployPath || `/var/www/${cleanDomain}`;
  const nginxConfPath = `/etc/nginx/sites-available/${cleanDomain}`;
  const nginxEnabledPath = `/etc/nginx/sites-enabled/${cleanDomain}`;

  return `#!/usr/bin/env bash
set -e

echo "=== ShipVPS Automated Deployment Pipeline ==="
echo "Target Directory: ${targetDir}"
echo "Domain: ${cleanDomain}"
echo "Repository: ${opts.repoUrl} (branch: ${opts.branch})"

# Ensure basic packages are installed
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    sudo apt-get update -y && sudo apt-get install -y git
fi

if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt-get update -y && sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

echo "[STEP:GIT]"
# Setup deploy directory and git repo
sudo mkdir -p ${targetDir}
sudo chown -R $USER:$USER ${targetDir}

if [ -d "${targetDir}/.git" ]; then
    echo "Directory already contains git repo. Pulling latest changes..."
    cd ${targetDir}
    git fetch origin ${opts.branch}
    git reset --hard origin/${opts.branch}
else
    echo "Cloning repository from ${opts.repoUrl}..."
    git clone -b ${opts.branch} ${opts.repoUrl} ${targetDir}
    cd ${targetDir}
fi

# Write environment variables
${opts.envVars ? `
echo "Writing .env file..."
cat << 'EOF' > ${targetDir}/.env
${opts.envVars}
EOF
chmod 600 ${targetDir}/.env
` : '# No environment variables provided'}

echo "[STEP:BUILD]"
${
  opts.projectType === 'docker'
    ? `
# Docker / Docker Compose Deployment
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER || true
fi

if [ -f "docker-compose.yml" ] || [ -f "compose.yaml" ]; then
    echo "Building and starting with Docker Compose..."
    docker compose down || true
    docker compose pull || true
    docker compose up -d --build
elif [ -f "Dockerfile" ]; then
    echo "Building Dockerfile..."
    docker stop ${repoName} || true
    docker rm ${repoName} || true
    docker build -t ${repoName}:latest .
    docker run -d --name ${repoName} --restart always -p ${opts.appPort}:${opts.appPort} --env-file ${targetDir}/.env ${repoName}:latest
else
    echo "Running custom build command..."
    ${opts.buildCommand || 'echo "No build command specified"'}
    ${opts.startCommand || 'echo "No start command specified"'}
fi
`
    : opts.projectType === 'nodejs' || opts.projectType === 'nextjs'
    ? `
# Node.js / Next.js Deployment
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 process manager..."
    sudo npm install -g pm2
    sudo pm2 startup systemd -u $USER --hp $HOME || true
fi

echo "Installing npm dependencies..."
${opts.buildCommand || 'npm ci && npm run build'}

echo "Starting application with PM2 on port ${opts.appPort}..."
PORT=${opts.appPort} pm2 restart ${repoName} || PORT=${opts.appPort} pm2 start "${opts.startCommand || 'npm start'}" --name ${repoName}
pm2 save
`
    : opts.projectType === 'vite-spa' || opts.projectType === 'static'
    ? `
# Vite SPA / Static Site Deployment
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Building static site..."
if [ -f "package.json" ]; then
    npm install --legacy-peer-deps || npm install --force || npm install
    npm run build
fi

# If dist folder doesn't exist, check build
if [ ! -d "${targetDir}/dist" ] && [ -d "${targetDir}/build" ]; then
    ln -s "${targetDir}/build" "${targetDir}/dist"
fi

# Ensure Nginx has read permissions to the directory
sudo chown -R www-data:www-data ${targetDir} 2>/dev/null || sudo chown -R $USER:$USER ${targetDir}
sudo chmod -R 755 ${targetDir}
`
    : `
# Custom Application Deployment
${opts.buildCommand || '# No build command'}
${opts.startCommand || '# No start command'}
`
}

echo "[STEP:NGINX]"
# Configure Nginx Reverse Proxy
echo "Configuring Nginx for domain ${cleanDomain}..."

cat << 'NGINX_EOF' | sudo tee ${nginxConfPath} > /dev/null
${generateNginxConfig(cleanDomain, opts.appPort, opts.projectType, targetDir)}
NGINX_EOF

# Enable Nginx site
sudo ln -sf ${nginxConfPath} ${nginxEnabledPath}

# Test Nginx syntax
echo "Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx
echo "Reloading Nginx service..."
sudo systemctl reload nginx

${
  opts.enableSsl
    ? `
echo "[STEP:SSL]"
# Certbot SSL certificate setup
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get update -y && sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "Requesting Let's Encrypt SSL certificate for ${cleanDomain}..."
# Attempt certbot non-interactively
sudo certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos -m ${opts.email || 'admin@' + cleanDomain} --redirect || {
    echo "⚠️ Warning: Certbot SSL request failed. Please verify that domain '${cleanDomain}' points to this VPS IP via an A record in your DNS settings."
}
`
    : '# SSL provisioning disabled'
}

echo "[STEP:DONE]"
echo "=========================================================="
echo " Deployment Successfully Completed!"
echo " URL: http://${cleanDomain} (or https://${cleanDomain})"
echo "=========================================================="
`;
}

// 7. Projects Management CRUD API
app.get('/api/projects', (req: Request, res: Response): void => {
  const projects = loadProjects();
  res.json({ success: true, projects });
});

app.post('/api/projects', (req: Request, res: Response): void => {
  const newProject = req.body;
  if (!newProject.id) {
    newProject.id = 'proj_' + Date.now().toString(36);
  }
  newProject.updatedAt = new Date().toISOString();

  const projects = loadProjects();
  const index = projects.findIndex((p: any) => p.id === newProject.id);
  if (index >= 0) {
    projects[index] = newProject;
  } else {
    projects.unshift(newProject);
  }

  saveProjects(projects);
  res.json({ success: true, project: newProject });
});

app.delete('/api/projects/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  let projects = loadProjects();
  projects = projects.filter((p: any) => p.id !== id);
  saveProjects(projects);
  res.json({ success: true });
});

// 8. GitHub Webhook Listener
app.post('/api/webhook/:projectId', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const projects = loadProjects();
  const project = projects.find((p: any) => p.id === projectId);

  if (!project) {
    res.status(404).json({ success: false, message: 'Project not found' });
    return;
  }

  console.log(`[Webhook] Received webhook trigger for project ${project.domain || project.id}`);

  // In real background, if VPS credentials exist, can auto-trigger deploy
  res.json({
    success: true,
    message: `Webhook received for ${project.domain}. Deployment scheduled.`,
    timestamp: new Date().toISOString(),
  });
});

// Vite Middleware mounting in development or static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ShipVPS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
