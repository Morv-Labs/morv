/**
 * Model Runners — BYOM (Bring Your Own Model)
 */

import { ModelConfig } from '../types';
import { withResolvedModelConfig, resolveApiKeyFromEnv } from './model-env';

export { resolveApiKeyFromEnv, DEFAULT_MODELS, PROVIDER_ENV_KEYS } from './model-env';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RunOptions {
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface ModelRunner {
  run(options: RunOptions): Promise<ModelResponse>;
}

class OpenAIRunner implements ModelRunner {
  constructor(
    private config: ModelConfig,
    private options?: { extraHeaders?: Record<string, string> }
  ) {}

  async run(options: RunOptions): Promise<ModelResponse> {
    const config = withResolvedModelConfig(this.config);
    if (!config.apiKey && config.provider !== 'ollama') {
      throw new Error(`Missing API key for provider "${config.provider}"`);
    }
    const messages: Message[] = [];
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    messages.push(...options.messages);

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
    };

    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey ?? ''}`,
      ...this.options?.extraHeaders,
    };
    if (config.provider === 'bai' && config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`${config.provider} error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{ function: { name: string; arguments: string } }>;
        };
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };
    const choice = data.choices[0];

    return {
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })),
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      model: data.model,
    };
  }
}

class AnthropicRunner implements ModelRunner {
  constructor(private config: ModelConfig) {}

  async run(options: RunOptions): Promise<ModelResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      messages: options.messages,
    };

    if (options.systemPrompt) body.system = options.systemPrompt;

    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const textBlock = data.content.find((b) => b.type === 'text');
    const toolBlocks = data.content.filter((b) => b.type === 'tool_use');

    return {
      content: textBlock?.text ?? '',
      toolCalls: toolBlocks.map((b) => ({
        name: b.name ?? '',
        arguments: b.input ?? {},
      })),
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
    };
  }
}

class GeminiRunner implements ModelRunner {
  constructor(private config: ModelConfig) {}

  async run(options: RunOptions): Promise<ModelResponse> {
    const contents = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens ?? 4096,
            temperature: this.config.temperature ?? 0.7,
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const candidate = data.candidates[0];

    return {
      content: candidate.content.parts.map((p) => p.text).join(''),
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      model: this.config.model,
    };
  }
}

class OllamaRunner implements ModelRunner {
  constructor(private config: ModelConfig) {}

  async run(options: RunOptions): Promise<ModelResponse> {
    const baseUrl = this.config.baseUrl ?? 'http://localhost:11434';
    const messages: Message[] = [];
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    messages.push(...options.messages);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
      model: string;
    };

    return {
      content: data.message.content,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      model: data.model,
    };
  }
}

export function createModelRunner(config: ModelConfig): ModelRunner {
  const resolved = withResolvedModelConfig(config);
  switch (resolved.provider) {
    case 'openai':
      return new OpenAIRunner(resolved);
    case 'groq':
    case 'grok':
    case 'bai':
    case 'custom':
      return new OpenAIRunner(resolved);
    case 'anthropic':
      return new AnthropicRunner(resolved);
    case 'gemini':
      return new GeminiRunner(resolved);
    case 'ollama':
      return new OllamaRunner(resolved);
    default:
      throw new Error(`Unknown model provider: ${resolved.provider as string}`);
  }
}
