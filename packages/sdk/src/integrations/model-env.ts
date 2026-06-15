/**
 * BYOM env resolution — Groq, B.AI, Grok (xAI), etc.
 */

import { ModelConfig, ModelProvider } from '../types';

export const PROVIDER_ENV_KEYS: Record<ModelProvider, string | null> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  ollama: null,
  groq: 'GROQ_API_KEY',
  grok: 'XAI_API_KEY',
  bai: 'BAI_API_KEY',
  custom: null,
};

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.2',
  groq: 'llama-3.3-70b-versatile',
  grok: 'grok-3-mini',
  bai: 'gpt-4o-mini',
  custom: 'default',
};

export const PROVIDER_BASE_URLS: Partial<Record<ModelProvider, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  grok: 'https://api.x.ai/v1',
  bai: 'https://api.b.ai/v1',
};

export function resolveApiKeyFromEnv(provider: ModelProvider): string | undefined {
  const key = PROVIDER_ENV_KEYS[provider];
  if (!key) return undefined;
  const val = process.env[key];
  if (val) return val;
  if (provider === 'grok') return process.env.GROK_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  return undefined;
}

export function withResolvedModelConfig(config: ModelConfig): ModelConfig {
  return {
    ...config,
    apiKey: config.apiKey ?? resolveApiKeyFromEnv(config.provider),
    model: config.model || DEFAULT_MODELS[config.provider],
    baseUrl: config.baseUrl ?? PROVIDER_BASE_URLS[config.provider],
  };
}
