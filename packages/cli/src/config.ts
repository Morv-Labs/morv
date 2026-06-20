import fs from 'fs';
import path from 'path';
import { PolicyConfig, ModelConfig, ModelProvider, resolveApiKeyFromEnv } from '@morv-labs/morv';

export const DEFAULT_MORV_API_URL = 'https://api.morv.run';

export const CONFIG_DIR = path.join(process.cwd(), '.morv');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/** Production API is fixed; override only via MORV_API_BASE_URL for self-host dev. */
export function resolveApiBaseUrl(config?: MorvCliConfig): string {
  return (
    process.env.MORV_API_BASE_URL?.replace(/\/$/, '') ??
    config?.apiBaseUrl?.replace(/\/$/, '') ??
    DEFAULT_MORV_API_URL
  );
}

export function resolveMarketplaceUrl(config?: MorvCliConfig): string {
  const base = resolveApiBaseUrl(config);
  return config?.marketplaceUrl?.replace(/\/$/, '') ?? `${base}/marketplace`;
}

export interface MorvAgentConfig {
  id: string;
  name?: string;
  model?: ModelConfig;
  policy: PolicyConfig;
  tools?: string[];
}

export interface MorvCliConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  marketplaceUrl?: string;
  defaultAgent?: string;
  model?: ModelConfig;
  agents?: MorvAgentConfig[];
  installedTools?: string[];
}

export function loadConfig(): MorvCliConfig {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as MorvCliConfig;
}

export function saveConfig(config: MorvCliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getAgentConfig(config: MorvCliConfig, agentId: string): MorvAgentConfig | undefined {
  return config.agents?.find((a) => a.id === agentId);
}

export function resolveAgentId(config: MorvCliConfig, agentId?: string): string {
  const id = agentId ?? config.defaultAgent ?? config.agents?.[0]?.id;
  if (!id) {
    throw new Error('No agent configured. Run: morv agent create <id>');
  }
  return id;
}

export function dbPath(): string {
  return path.join(CONFIG_DIR, 'morv.db');
}

/** Model API key: agent config → global config → env */
export function resolveModelApiKey(
  config: MorvCliConfig,
  agentModel?: ModelConfig
): string | undefined {
  const provider = agentModel?.provider ?? config.model?.provider;
  if (!provider) return undefined;
  return (
    agentModel?.apiKey ??
    config.model?.apiKey ??
    resolveApiKeyFromEnv(provider as ModelProvider)
  );
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
