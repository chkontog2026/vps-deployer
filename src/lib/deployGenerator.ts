import { RepositoryConfig, DomainConfig, VpsCredentials } from '../types';

export function buildBashScript(
  repo: RepositoryConfig,
  domain: DomainConfig,
  vps?: VpsCredentials
): string {
  const cleanDomain = domain.domain ? domain.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim() : 'example.com';
  const repoName = repo.repoUrl.split('/').pop()?.replace('.git', '') || 'app';
  const targetDir = repo.deployPath || `/var/www/${cleanDomain}`;
  const nginxConfPath = `/etc/nginx/sites-available/${cleanDomain}`;
  const nginxEnabledPath = `/etc/nginx/sites-enabled/${cleanDomain}`;

  return `#!/usr/bin/env bash
# ==============================================================================
# ShipVPS - Automated Zero-Downtime Deployment Script
# Target Domain: ${cleanDomain}
# Repository:    ${repo.repoUrl} (branch: ${repo.branch})
# Generated at:  ${new Date().toISOString()}
# ==============================================================================
set -e

echo "🚀 [1/6] Installing system prerequisites (Git, Nginx, Curl)..."
sudo apt-get update -y
sudo apt-get install -y git curl nginx ufw

# Allow Nginx HTTP and HTTPS through firewall
sudo ufw allow 'Nginx Full' || true
sudo ufw allow 22/tcp || true

echo "📁 [2/6] Setting up project directory at ${targetDir}..."
sudo mkdir -p ${targetDir}
sudo chown -R $USER:$USER ${targetDir}

if [ -d "${targetDir}/.git" ]; then
    echo "Existing repository detected. Pulling latest commits from ${repo.branch}..."
    cd ${targetDir}
    git fetch origin ${repo.branch}
    git reset --hard origin/${repo.branch}
else
    echo "Cloning repository from ${repo.repoUrl}..."
    git clone -b ${repo.branch} ${repo.repoUrl} ${targetDir}
    cd ${targetDir}
fi

${repo.envVars ? `
echo "🔐 [3/6] Configuring .env environment variables..."
cat << 'EOF' > ${targetDir}/.env
${repo.envVars}
EOF
chmod 600 ${targetDir}/.env
` : `
echo "ℹ️ [3/6] No custom .env specified. Skipping environment file creation."
`}

echo "⚙️ [4/6] Building and running application..."
${
  repo.projectType === 'docker'
    ? `# Docker Application Pipeline
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER || true
fi

if [ -f "docker-compose.yml" ] || [ -f "compose.yaml" ]; then
    echo "Starting Docker Compose services..."
    docker compose down || true
    docker compose pull || true
    docker compose up -d --build
elif [ -f "Dockerfile" ]; then
    echo "Building Docker container image..."
    docker stop ${repoName} 2>/dev/null || true
    docker rm ${repoName} 2>/dev/null || true
    docker build -t ${repoName}:latest .
    docker run -d --name ${repoName} --restart always -p ${repo.appPort}:${repo.appPort} ${repo.envVars ? `--env-file ${targetDir}/.env` : ''} ${repoName}:latest
else
    ${repo.buildCommand || 'echo "Running build..."'}
    ${repo.startCommand || 'echo "Running start..."'}
fi
`
    : repo.projectType === 'nodejs' || repo.projectType === 'nextjs'
    ? `# Node.js / Next.js Production Pipeline
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 process manager..."
    sudo npm install -g pm2
    sudo pm2 startup systemd -u $USER --hp $HOME || true
fi

echo "Installing dependencies and compiling..."
${repo.buildCommand || 'npm ci && npm run build'}

echo "Launching service via PM2..."
PORT=${repo.appPort} pm2 restart ${repoName} 2>/dev/null || PORT=${repo.appPort} pm2 start "${repo.startCommand || 'npm start'}" --name ${repoName}
pm2 save
`
    : repo.projectType === 'vite-spa' || repo.projectType === 'static'
    ? `# Static Web / Single Page Application Pipeline
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Building static production bundle..."
if [ -f "package.json" ]; then
    npm install --legacy-peer-deps || npm install --force || npm install
    npm run build
fi

if [ ! -d "${targetDir}/dist" ] && [ -d "${targetDir}/build" ]; then
    ln -sf "${targetDir}/build" "${targetDir}/dist"
fi

sudo chown -R www-data:www-data ${targetDir} 2>/dev/null || sudo chown -R $USER:$USER ${targetDir}
sudo chmod -R 755 ${targetDir}
`
    : `# Custom Application Pipeline
${repo.buildCommand || '# Custom build command'}
${repo.startCommand || '# Custom start command'}
`
}

echo "🌐 [5/6] Configuring Nginx reverse proxy for ${cleanDomain}..."

cat << 'NGINX_CONF' | sudo tee ${nginxConfPath} > /dev/null
${buildNginxConfig(cleanDomain, repo.appPort, repo.projectType, targetDir)}
NGINX_CONF

sudo ln -sf ${nginxConfPath} ${nginxEnabledPath}

# Validate configuration
echo "Validating Nginx syntax..."
sudo nginx -t

# Reload Nginx server
echo "Reloading Nginx..."
sudo systemctl reload nginx

${
  domain.enableSsl
    ? `
echo "🔒 [6/6] Requesting SSL Certificate from Let's Encrypt (Certbot)..."
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get update -y && sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "Obtaining SSL certificate for ${cleanDomain}..."
sudo certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos -m ${domain.email || 'admin@' + cleanDomain} --redirect || {
    echo "⚠️ Certbot challenge failed. Make sure your domain's DNS A Record points to this VPS IP before rerunning."
}
`
    : `echo "ℹ️ [6/6] SSL disabled. Serving over HTTP."`
}

echo "=========================================================="
echo "✨ Deployment Complete! Your app is now live at:"
echo "   http://${cleanDomain} (or https://${cleanDomain})"
echo "=========================================================="
`;
}

export function buildNginxConfig(
  domain: string,
  port: number,
  projectType: string,
  deployPath: string
): string {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  if (projectType === 'vite-spa' || projectType === 'static') {
    return `server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain} www.${cleanDomain};

    root ${deployPath}/dist;
    index index.html index.htm;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    access_log /var/log/nginx/${cleanDomain}_access.log;
    error_log /var/log/nginx/${cleanDomain}_error.log;
}`;
  }

  return `server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain} www.${cleanDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/${cleanDomain}_access.log;
    error_log /var/log/nginx/${cleanDomain}_error.log;
}`;
}
