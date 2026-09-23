export type ProjectType = 'docker' | 'nodejs' | 'nextjs' | 'vite-spa' | 'python' | 'static' | 'custom';

export interface VpsCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  authType: 'password' | 'privateKey';
}

export interface VpsDiagnostics {
  git: boolean;
  docker: boolean;
  nginx: boolean;
  certbot: boolean;
  node: boolean;
}

export interface RepositoryConfig {
  repoUrl: string;
  branch: string;
  githubToken?: string;
  projectType: ProjectType;
  buildCommand: string;
  startCommand: string;
  appPort: number;
  deployPath: string;
  envVars: string;
}

export interface DomainConfig {
  domain: string;
  enableSsl: boolean;
  email: string;
  dnsVerified?: boolean;
  resolvedIps?: string[];
  expectedIp?: string;
}

export interface DeploymentLog {
  id: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'stdout' | 'step';
  message: string;
  timestamp: string;
  step?: number;
}

export interface DeploymentProject {
  id: string;
  name: string;
  status: 'idle' | 'deploying' | 'healthy' | 'error' | 'offline';
  lastDeployedAt?: string;
  vps: VpsCredentials;
  repo: RepositoryConfig;
  domain: DomainConfig;
  liveStatus?: {
    online: boolean;
    statusCode?: number;
    latencyMs?: number;
    lastChecked?: string;
  };
  diagnostics?: VpsDiagnostics;
  createdAt: string;
  updatedAt: string;
}
