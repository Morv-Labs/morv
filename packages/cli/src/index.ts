#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  MorvClient,
  AgentGuard,
  MockWallet,
  DEFAULT_POLICY,
  PolicyConfig,
  ModelConfig,
  DEFAULT_MODELS,
  PROVIDER_ENV_KEYS,
  resolveApiKeyFromEnv,
} from '@morv-labs/morv';
import {
  loadConfig,
  saveConfig,
  getAgentConfig,
  resolveAgentId,
  dbPath,
  resolveModelApiKey,
  resolveApiBaseUrl,
  resolveMarketplaceUrl,
  DEFAULT_MORV_API_URL,
  maskSecret,
  MorvAgentConfig,
} from './config';
import { printMorvBanner, printRunningHeader } from './banner';

const program = new Command();

program
  .name('morv')
  .description('Morv Labs — AI Agent Infrastructure (MCP + x402 + BYOM + AgentGuard)')
  .version('0.1.0');

const RETRO = {
  accent: chalk.hex('#f59e0b'),
  soft: chalk.hex('#d4b178'),
  dim: chalk.hex('#8a6a2f'),
  ok: chalk.hex('#84cc16'),
  warn: chalk.hex('#f59e0b'),
  err: chalk.hex('#ef4444'),
};

function renderBanner(title = 'MORV LABS') {
  return printMorvBanner({ subtitle: title.replace(/^MORV /, ''), animate: false });
}

async function renderBannerAnimated(title: string, boot = false) {
  await printMorvBanner({
    subtitle: title.replace(/^MORV /, ''),
    animate: true,
    boot,
  });
}

function info(label: string, value: string) {
  console.log(`${RETRO.dim('>')} ${RETRO.soft(label)} ${value}`);
}

function ok(message: string) {
  console.log(`${RETRO.ok('[ok]')} ${message}`);
}

function warn(message: string) {
  console.log(`${RETRO.warn('[warn]')} ${message}`);
}

function fail(message: string): never {
  console.error(`${RETRO.err('[err]')} ${message}`);
  process.exit(1);
}

const spinner = (label: string) => ora({ text: RETRO.soft(label), spinner: 'dots' }).start();

async function promptApiKeys(opts: {
  modelProvider: ModelConfig['provider'];
  requireMorvKey?: boolean;
}): Promise<{ modelApiKey?: string; morvApiKey?: string }> {
  const prompts: inquirer.DistinctQuestion[] = [];

  if (opts.modelProvider !== 'ollama') {
    const envVar = PROVIDER_ENV_KEYS[opts.modelProvider] ?? 'OPENAI_API_KEY';
    const existing = resolveApiKeyFromEnv(opts.modelProvider);
    prompts.push({
      type: 'password',
      name: 'modelApiKey',
      message: `${envVar} (paste key, hidden):`,
      mask: '*',
      default: existing,
      validate: (v: string) => (v?.trim() ? true : `Required — get one from your ${opts.modelProvider} provider`),
    });
  }

  prompts.push({
    type: 'password',
    name: 'morvApiKey',
    message: 'MORV_API_KEY (mv_... from https://morv.run dashboard):',
    mask: '*',
    validate: (v: string) => {
      if (!opts.requireMorvKey) return true;
      return v?.trim() ? true : 'Required — sign in at https://morv.run and copy your API key';
    },
  });

  return inquirer.prompt(prompts);
}

// ── INIT ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize Morv project')
  .option('--api-url <url>', 'Self-host only — default is https://api.morv.run')
  .action(async (opts: { apiUrl?: string }) => {
    await renderBannerAnimated('MORV INIT', true);
    const apiBaseUrl = opts.apiUrl?.replace(/\/$/, '') ?? DEFAULT_MORV_API_URL;
    info('api    :', apiBaseUrl);
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'modelProvider',
        message: 'Default AI model provider (BYOM):',
        choices: [
          { name: 'Groq (free tier)', value: 'groq' },
          { name: 'B.AI (free credits)', value: 'bai' },
          { name: 'Grok / xAI', value: 'grok' },
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Gemini', value: 'gemini' },
          { name: 'Ollama (local)', value: 'ollama' },
        ],
        default: 'groq',
      },
      {
        type: 'input',
        name: 'modelName',
        message: 'Model name:',
        default: (a: { modelProvider: ModelConfig['provider'] }) =>
          DEFAULT_MODELS[a.modelProvider] ?? 'llama-3.3-70b-versatile',
      },
    ]);

    const keys = await promptApiKeys({
      modelProvider: answers.modelProvider as ModelConfig['provider'],
      requireMorvKey: true,
    });

    const morvApiKey = keys.morvApiKey?.trim();
    if (!morvApiKey) {
      fail('Morv API key required. Sign in at https://morv.run then run: morv login --key mv_...');
    }

    const config = {
      apiBaseUrl,
      marketplaceUrl: `${apiBaseUrl}/marketplace`,
      apiKey: morvApiKey,
      model: {
        provider: answers.modelProvider as ModelConfig['provider'],
        model: answers.modelName,
        ...(keys.modelApiKey?.trim() ? { apiKey: keys.modelApiKey.trim() } : {}),
      },
      agents: [] as MorvAgentConfig[],
      installedTools: [] as string[],
    };
    saveConfig(config);

    const envVar = PROVIDER_ENV_KEYS[answers.modelProvider as ModelConfig['provider']] ?? 'OPENAI_API_KEY';
    const agentExample = `/**
 * Morv Agent — DCA bot example on Base
 * Run: morv login --key mv_... && morv run "Scan Base and DCA if dip detected"
 *
 * BYOM: set ${envVar} in .env
 * Wallet: BANKR_API_KEY + BANKR_AGENT_ADDRESS
 */
import { MorvClient } from '@morv-labs/morv';

const morv = new MorvClient({
  apiBaseUrl: '${apiBaseUrl}',
  apiKey: process.env.MORV_API_KEY!,
});

const agent = await morv.createAgent({
  id: 'dca-bot',
  model: { provider: '${answers.modelProvider}', model: '${answers.modelName}' },
  policy: { dailyLimitUsd: 200, perTxLimitUsd: 50, autoPause: true },
  tools: ['base-x402-discovery', 'base-web-scraper'],
});

const answer = await agent.run(process.argv[2] ?? 'Scan Base pools and DCA if ETH dips 3%');
console.log(answer);
`;
    fs.writeFileSync(path.join(process.cwd(), 'agent.morv.ts'), agentExample);

    ok('Morv initialized');
    if (config.model.apiKey) info('model key:', maskSecret(config.model.apiKey));
    if (config.apiKey) info('morv key :', maskSecret(config.apiKey));
    info('next:', 'morv agent create dca-bot --tools base-x402-discovery');
    info('next:', 'morv add base-x402-discovery');
    info('next:', "morv run 'Scan Base pools and DCA if dip detected'");
    info('next:', 'morv guard status');
  });

// ── SETUP (re-enter API keys) ───────────────────────────────────────────────

program
  .command('setup')
  .description('Set or update API keys interactively')
  .action(async () => {
    await renderBannerAnimated('MORV SETUP');
    const config = loadConfig();
    if (!config.model?.provider) {
      fail('Run morv init first');
    }

    const keys = await promptApiKeys({
      modelProvider: config.model.provider,
      requireMorvKey: false,
    });

    if (keys.modelApiKey?.trim()) {
      config.model = { ...config.model, apiKey: keys.modelApiKey.trim() };
    }
    if (keys.morvApiKey?.trim()) {
      config.apiKey = keys.morvApiKey.trim();
    }
    saveConfig(config);
    ok('Keys saved to .morv/config.json');
    if (config.model.apiKey) info('model key:', maskSecret(config.model.apiKey));
    if (config.apiKey) info('morv key :', maskSecret(config.apiKey));
  });

// ── REGISTER ────────────────────────────────────────────────────────────────

program
  .command('register')
  .description('(Deprecated) Use https://morv.run to sign up, then morv login')
  .option('-e, --email <email>', 'Email')
  .action(async (opts: { email?: string }) => {
    await renderBannerAnimated('MORV REGISTER');
    warn('CLI registration is deprecated. Sign in at https://morv.run and copy your API key.');
    warn('Then run: morv login --key mv_...');
    const config = loadConfig();
    const morv = new MorvClient({ apiBaseUrl: resolveApiBaseUrl(config) });
    const spin = spinner('registering account...');
    try {
      const { accountId, apiKey, creditsUsd } = await morv.register(opts.email);
      config.apiKey = apiKey;
      saveConfig(config);
      spin.succeed(RETRO.ok('registered'));
      info('account:', accountId);
      info('apiKey :', RETRO.accent(apiKey));
      if (creditsUsd != null) {
        info('credits:', RETRO.ok(`$${creditsUsd.toFixed(2)} USD`));
      }
      info('billing:', 'users spend credits; Bankr pays onchain');
    } catch (err) {
      spin.fail(RETRO.err('register failed'));
      fail(String(err));
    }
  });

// ── LOGIN ───────────────────────────────────────────────────────────────────

program
  .command('login')
  .option('-k, --key <key>', 'API key')
  .action(async (opts: { key?: string }) => {
    await renderBannerAnimated('MORV LOGIN');
    const config = loadConfig();
    let apiKey = opts.key ?? process.env.MORV_API_KEY;
    if (!apiKey) {
      const { morvApiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'morvApiKey',
          message: 'MORV_API_KEY (mv_... from morv.run):',
          mask: '*',
          validate: (v: string) => (v?.trim() ? true : 'API key required'),
        },
      ]);
      apiKey = morvApiKey.trim();
    }
    if (!apiKey) fail('API key required');
    config.apiKey = apiKey;
    saveConfig(config);
    ok('API key saved');
    info('morv key:', maskSecret(apiKey));
  });

// ── ADD (top-level MCP install) ─────────────────────────────────────────────

program
  .command('add <toolId>')
  .description('Install MCP tool from marketplace')
  .action(async (toolId: string) => {
    await renderBannerAnimated('MORV TOOL INSTALL');
    const config = loadConfig();
    config.installedTools = config.installedTools ?? [];
    if (config.installedTools.includes(toolId)) {
      warn(`Tool '${toolId}' already installed`);
      return;
    }
    const spin = spinner(`installing ${toolId}...`);
    try {
      const apiBase = resolveApiBaseUrl(config);
      const headers: Record<string, string> = {};
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      const res = await fetch(`${apiBase}/marketplace/tools/${encodeURIComponent(toolId)}`, { headers });
      if (!res.ok) {
        spin.fail(RETRO.err(`tool '${toolId}' not found`));
        return;
      }
      const tool = (await res.json()) as { id: string; name: string; pricing: { type: string; pricePerRequestUsd?: number } };
      config.installedTools.push(toolId);
      saveConfig(config);
      spin.succeed(RETRO.ok(`installed ${tool.name}`));
      info('price:', tool.pricing.type === 'free' ? 'free' : `$${tool.pricing.pricePerRequestUsd}/req`);
    } catch (err) {
      spin.fail(RETRO.err('install failed'));
      fail(String(err));
    }
  });

// ── RUN ─────────────────────────────────────────────────────────────────────

program
  .command('run [prompt]')
  .description('Run agent with BYOM + MCP tools')
  .option('-a, --agent <id>', 'Agent ID')
  .option('-t, --tool <toolId>', 'Call single MCP tool instead of LLM')
  .option('--input <json>', 'Tool input JSON')
  .action(async (prompt: string | undefined, opts: { agent?: string; tool?: string; input?: string }) => {
    await renderBannerAnimated('MORV RUNTIME', true);
    const config = loadConfig();
    const agentId = resolveAgentId(config, opts.agent);
    const agentCfg = getAgentConfig(config, agentId);
    if (!agentCfg) {
      fail(`Agent '${agentId}' not found. Run: morv agent create ${agentId}`);
    }

    const model = agentCfg.model ?? config.model;
    const resolvedKey = resolveModelApiKey(config, model);
    if (!opts.tool && !resolvedKey && model?.provider !== 'ollama') {
      const envHint = model ? PROVIDER_ENV_KEYS[model.provider] : 'GROQ_API_KEY';
      fail(`No model API key. Run: morv setup   (or export ${envHint}=...)`);
    }

    if (!config.apiKey) {
      fail('No Morv API key. Sign in at https://morv.run then run: morv login --key mv_...');
    }

    const apiBase = resolveApiBaseUrl(config);
    const morv = new MorvClient({
      apiKey: config.apiKey,
      apiBaseUrl: apiBase,
      dbPath: dbPath(),
    });

    info('wallet:', 'Morv credits (server-side settlement via api.morv.run)');
    const runPrompt = prompt ?? 'Hello, what can you help me with?';
    printRunningHeader(agentId, opts.tool ? `tool:${opts.tool}` : runPrompt);

    const tools = [...(agentCfg.tools ?? []), ...(config.installedTools ?? [])];
    const uniqueTools = [...new Set(tools)];

    const spin = spinner('starting agent...');
    try {
      const agent = await morv.createAgent(
        {
          id: agentId,
          model: {
            ...model!,
            apiKey: resolvedKey,
          },
          policy: agentCfg.policy,
          tools: uniqueTools,
        }
      );

      if (opts.tool) {
        spin.text = RETRO.soft(`calling MCP tool: ${opts.tool}`);
        const input = opts.input ? (JSON.parse(opts.input) as Record<string, unknown>) : {};
        const result = await agent.useTool(opts.tool, input);
        spin.succeed(RETRO.ok('tool result'));
        console.log(JSON.stringify(result.output, null, 2));
        agent.guard.destroy();
        return;
      }

      spin.text = RETRO.soft('running agent...');
      const answer = await agent.run(prompt ?? 'Hello, what can you help me with?');
      spin.succeed(RETRO.ok('completed'));
      console.log('\n' + RETRO.soft('--- AGENT OUTPUT ---') + '\n' + answer);
      agent.guard.destroy();
    } catch (err) {
      spin.fail(RETRO.err('run failed'));
      fail(String(err));
    }
  });

// ── MONITOR ─────────────────────────────────────────────────────────────────

program
  .command('monitor [agentId]')
  .description('Watch agent budget & status (live)')
  .option('-i, --interval <sec>', 'Refresh interval', '5')
  .action(async (agentId: string | undefined, opts: { interval: string }) => {
    await renderBannerAnimated('MORV MONITOR');
    const config = loadConfig();
    const id = resolveAgentId(config, agentId);
    const agentCfg = getAgentConfig(config, id);
    const policy = (agentCfg?.policy ?? DEFAULT_POLICY) as PolicyConfig;

    const refresh = () => {
      const guard = new AgentGuard({
        agentId: id,
        wallet: new MockWallet(),
        policy,
        dbPath: dbPath(),
      });
      const s = guard.status();
      console.clear();
      renderBanner(`MORV MONITOR // ${s.agentId}`);
      console.log(`Status: ${s.isPaused ? RETRO.err('PAUSED') : RETRO.ok('ACTIVE')}`);
      console.log(`Budget: $${s.spentTodayUsd} / $${s.policy.dailyLimitUsd}  (${s.policy.dailyRemainingUsd} left)`);
      console.log(`Tx/hr : ${s.txLastHour}  |  Tx/min: ${s.txLast60s}`);
      info('category:', JSON.stringify(s.byCategoryToday));
      info('refresh :', `${opts.interval}s (Ctrl+C to stop)`);
      guard.destroy();
    };

    refresh();
    setInterval(refresh, parseInt(opts.interval, 10) * 1000);
  });

// ── AGENT ─────────────────────────────────────────────────────────────────────

const agentCmd = program.command('agent').description('Manage agents');

agentCmd
  .command('create <id>')
  .option('--daily <usd>', 'Daily limit', '50')
  .option('--per-tx <usd>', 'Per-tx limit', '10')
  .option('--tools <ids>', 'Comma-separated MCP tool IDs')
  .option('--provider <name>', 'Model provider (groq, bai, grok, openai, ...)')
  .option('--model <name>', 'Model id')
  .action((id: string, opts: { daily: string; perTx: string; tools?: string; provider?: string; model?: string }) => {
    const config = loadConfig();
    config.agents = config.agents ?? [];
    if (config.agents.find((a) => a.id === id)) {
      fail(`Agent '${id}' exists`);
    }
    config.agents.push({
      id,
      policy: {
        dailyLimitUsd: parseFloat(opts.daily),
        perTxLimitUsd: parseFloat(opts.perTx),
        autoPause: true,
      },
      model: {
        provider: (opts.provider ?? config.model?.provider ?? 'groq') as ModelConfig['provider'],
        model: opts.model ?? config.model?.model ?? DEFAULT_MODELS.groq,
      },
      tools: opts.tools?.split(',').map((t) => t.trim()),
    });
    if (!config.defaultAgent) config.defaultAgent = id;
    saveConfig(config);
    ok(`Agent '${id}' created`);
    info('run:', `morv run -a ${id} "Scan Base and DCA if dip detected"`);
  });

agentCmd.command('list').action(() => {
  const config = loadConfig();
  (config.agents ?? []).forEach((a) => {
    console.log(`  ${chalk.cyan(a.id)} — tools: ${a.tools?.join(', ') || 'none'}`);
  });
});

// ── GUARD (AgentGuard submodule) ────────────────────────────────────────────

const guardCmd = program.command('guard').description('AgentGuard — spending policy layer');

guardCmd
  .command('status [agentId]')
  .action(async (agentId?: string) => {
    await renderBannerAnimated('AGENTGUARD STATUS');
    const config = loadConfig();
    const id = resolveAgentId(config, agentId);
    const policy = (getAgentConfig(config, id)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
    const guard = new AgentGuard({ agentId: id, wallet: new MockWallet(), policy, dbPath: dbPath() });
    const s = guard.status();
    console.log(RETRO.soft(`agent: ${s.agentId}`));
    console.log(`status   : ${s.isPaused ? RETRO.err('PAUSED') : RETRO.ok('ACTIVE')}`);
    console.log(`spent    : $${s.spentTodayUsd} / $${s.policy.dailyLimitUsd}`);
    console.log(`remaining: $${s.policy.dailyRemainingUsd}`);
    guard.destroy();
  });

guardCmd.command('pause <agentId>').action((agentId: string) => {
  const config = loadConfig();
  const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
  const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
  guard.pause('Manual pause via CLI');
  guard.destroy();
  warn(`${agentId} paused`);
});

guardCmd.command('resume <agentId>').action((agentId: string) => {
  const config = loadConfig();
  const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
  const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
  guard.resume();
  guard.destroy();
  ok(`${agentId} resumed`);
});

guardCmd
  .command('history <agentId>')
  .option('-n, --limit <n>', 'Limit', '10')
  .action((agentId: string, opts: { limit: string }) => {
    const config = loadConfig();
    const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
    const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
    guard.history(parseInt(opts.limit, 10)).forEach((tx: any) => {
      const icon = tx.status === 'approved' ? chalk.green('✓') : chalk.red('✗');
      console.log(`${icon} $${tx.amountUsd.toFixed(2)} [${tx.category}] ${tx.memo || tx.toAddress.slice(0, 12)}`);
    });
    guard.destroy();
  });

guardCmd.command('policy').action(() => {
  console.log(JSON.stringify(DEFAULT_POLICY, null, 2));
});

// ── TOOLS (marketplace) ─────────────────────────────────────────────────────

const toolsCmd = program.command('tools').description('MCP marketplace');

toolsCmd
  .command('search [query]')
  .action(async (query = '') => {
    const config = loadConfig();
    const morv = new MorvClient({
      apiKey: config.apiKey,
      marketplaceUrl: resolveMarketplaceUrl(config),
    });
    const result = await morv.searchMarketplace(query);
    result.tools.forEach((t: any) => {
      const price = t.pricing.type === 'free' ? 'free' : `$${t.pricing.pricePerRequestUsd}/req`;
      console.log(`${chalk.cyan(t.id)} — ${t.name} [${price}]`);
    });
  });

toolsCmd.command('list').action(() => {
  const tools = loadConfig().installedTools ?? [];
  tools.forEach((t) => console.log(`  ${chalk.cyan(t)}`));
});

// ── BILLING ─────────────────────────────────────────────────────────────────

const billingCmd = program.command('billing').description('Usage & billing');

billingCmd.command('usage').action(async () => {
  const config = loadConfig();
  const morv = new MorvClient({ apiKey: config.apiKey, apiBaseUrl: resolveApiBaseUrl(config) });
  console.log(JSON.stringify(await morv.billing.getUsage(), null, 2));
});

billingCmd.command('statement').action(async () => {
  const config = loadConfig();
  const morv = new MorvClient({ apiKey: config.apiKey, apiBaseUrl: resolveApiBaseUrl(config) });
  console.log(JSON.stringify(await morv.billing.getStatement(), null, 2));
});

program.parse();
