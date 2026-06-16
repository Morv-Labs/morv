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
  createWalletFromEnv,
  detectWalletMode,
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
  MorvAgentConfig,
} from './config';

const program = new Command();

program
  .name('morv')
  .description('Morv Labs — AI Agent Infrastructure (MCP + x402 + BYOM + AgentGuard)')
  .version('0.1.0');

// ── INIT ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize Morv project')
  .action(async () => {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'apiBaseUrl', message: 'Morv API URL:', default: 'http://localhost:3001' },
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

    const config = {
      apiBaseUrl: answers.apiBaseUrl,
      marketplaceUrl: `${answers.apiBaseUrl}/marketplace`,
      model: {
        provider: answers.modelProvider as ModelConfig['provider'],
        model: answers.modelName,
      },
      agents: [] as MorvAgentConfig[],
      installedTools: [] as string[],
    };
    saveConfig(config);

    const envVar = PROVIDER_ENV_KEYS[answers.modelProvider as ModelConfig['provider']] ?? 'OPENAI_API_KEY';
    const agentExample = `/**
 * Morv Agent — DCA bot example on Base
 * Run: morv register && morv run "Scan Base and DCA if dip detected"
 *
 * BYOM: set ${envVar} in .env
 * Wallet: BANKR_API_KEY + BANKR_AGENT_ADDRESS
 */
import { MorvClient } from '@morv-labs/morv';

const morv = new MorvClient({
  apiBaseUrl: '${answers.apiBaseUrl}',
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

    console.log(chalk.green('\n✓ Morv initialized'));
    console.log(chalk.dim('  morv register          → get API key'));
    console.log(chalk.dim('  morv agent create demo → create agent'));
    console.log(chalk.dim('  morv add base-x402-discovery → install MCP tool'));
    console.log(chalk.dim('  morv run "prompt"      → run agent'));
    console.log(chalk.dim('  morv guard status      → AgentGuard budget'));
  });

// ── REGISTER ────────────────────────────────────────────────────────────────

program
  .command('register')
  .description('Register on Morv control plane (get API key)')
  .option('-e, --email <email>', 'Email')
  .action(async (opts: { email?: string }) => {
    const config = loadConfig();
    const morv = new MorvClient({ apiBaseUrl: config.apiBaseUrl ?? 'http://localhost:3001' });
    const spinner = ora('Registering...').start();
    try {
      const { accountId, apiKey, creditsUsd } = await morv.register(opts.email);
      config.apiKey = apiKey;
      saveConfig(config);
      spinner.succeed('Registered');
      console.log(chalk.dim(`  Account: ${accountId}`));
      console.log(chalk.yellow(`  API Key: ${apiKey}`));
      if (creditsUsd != null) {
        console.log(chalk.green(`  Morv credits: $${creditsUsd.toFixed(2)} USD`));
      }
      console.log(chalk.dim('  Users spend credits · your Bankr wallet pays onchain'));
    } catch (err) {
      spinner.fail(String(err));
    }
  });

// ── LOGIN ───────────────────────────────────────────────────────────────────

program
  .command('login')
  .option('-k, --key <key>', 'API key')
  .action((opts: { key?: string }) => {
    const config = loadConfig();
    config.apiKey = opts.key ?? process.env.MORV_API_KEY;
    if (!config.apiKey) {
      console.error(chalk.red('Provide --key or MORV_API_KEY'));
      process.exit(1);
    }
    saveConfig(config);
    console.log(chalk.green('✓ API key saved'));
  });

// ── ADD (top-level MCP install) ─────────────────────────────────────────────

program
  .command('add <toolId>')
  .description('Install MCP tool from marketplace')
  .action(async (toolId: string) => {
    const config = loadConfig();
    config.installedTools = config.installedTools ?? [];
    if (config.installedTools.includes(toolId)) {
      console.log(chalk.yellow(`Tool '${toolId}' already installed`));
      return;
    }
    const spinner = ora(`Installing ${toolId}...`).start();
    try {
      const morv = new MorvClient({
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl ?? 'http://localhost:3001',
      });
      const result = await morv.searchMarketplace(toolId);
      const tool = result.tools.find((t) => t.id === toolId);
      if (!tool) {
        spinner.fail(`Tool '${toolId}' not found`);
        return;
      }
      config.installedTools.push(toolId);
      saveConfig(config);
      spinner.succeed(`Installed ${tool.name} (${tool.pricing.type === 'free' ? 'free' : `$${tool.pricing.pricePerRequestUsd}/req`})`);
    } catch (err) {
      spinner.fail(String(err));
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
    const config = loadConfig();
    const agentId = resolveAgentId(config, opts.agent);
    const agentCfg = getAgentConfig(config, agentId);
    if (!agentCfg) {
      console.error(chalk.red(`Agent '${agentId}' not found. Run: morv agent create ${agentId}`));
      process.exit(1);
    }

    const model = agentCfg.model ?? config.model;
    const resolvedKey = model?.apiKey ?? (model ? resolveApiKeyFromEnv(model.provider) : undefined);
    if (!opts.tool && !resolvedKey && model?.provider !== 'ollama') {
      const envHint = model ? PROVIDER_ENV_KEYS[model.provider] : 'GROQ_API_KEY';
      console.error(chalk.red(`Set API key: export ${envHint}=...`));
      process.exit(1);
    }

    const apiBase = config.apiBaseUrl ?? 'http://localhost:3001';
    const morv = new MorvClient({
      apiKey: config.apiKey,
      apiBaseUrl: apiBase,
      dbPath: dbPath(),
    });

    const useCredits = Boolean(config.apiKey) && process.env.MORV_USE_CREDITS !== 'false';
    if (useCredits) {
      console.log(chalk.dim(`  Wallet: Morv credits (platform: ${detectWalletMode()})`));
    } else {
      const wallet = createWalletFromEnv({ allowMock: process.env.NODE_ENV !== 'production' });
      console.log(chalk.dim(`  Wallet: ${detectWalletMode()} (${wallet.getAddress?.() ?? 'n/a'})`));
    }
    const tools = [...(agentCfg.tools ?? []), ...(config.installedTools ?? [])];
    const uniqueTools = [...new Set(tools)];

    const spinner = ora('Starting agent...').start();
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
        },
        useCredits ? undefined : createWalletFromEnv({ allowMock: process.env.NODE_ENV !== 'production' })
      );

      if (opts.tool) {
        spinner.text = `Calling MCP tool: ${opts.tool}`;
        const input = opts.input ? (JSON.parse(opts.input) as Record<string, unknown>) : {};
        const result = await agent.useTool(opts.tool, input);
        spinner.succeed('Tool result');
        console.log(JSON.stringify(result.output, null, 2));
        agent.guard.destroy();
        return;
      }

      spinner.text = 'Running agent...';
      const answer = await agent.run(prompt ?? 'Hello, what can you help me with?');
      spinner.succeed('Done');
      console.log('\n' + answer);
      agent.guard.destroy();
    } catch (err) {
      spinner.fail(String(err));
      process.exit(1);
    }
  });

// ── MONITOR ─────────────────────────────────────────────────────────────────

program
  .command('monitor [agentId]')
  .description('Watch agent budget & status (live)')
  .option('-i, --interval <sec>', 'Refresh interval', '5')
  .action((agentId: string | undefined, opts: { interval: string }) => {
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
      console.log(chalk.bold(`Morv Monitor — ${s.agentId}`));
      console.log(`Status: ${s.isPaused ? chalk.red('PAUSED') : chalk.green('ACTIVE')}`);
      console.log(`Budget: $${s.spentTodayUsd} / $${s.policy.dailyLimitUsd}  (${s.policy.dailyRemainingUsd} left)`);
      console.log(`Tx/hr: ${s.txLastHour}  |  Tx/min: ${s.txLast60s}`);
      console.log(chalk.dim(`Categories: ${JSON.stringify(s.byCategoryToday)}`));
      console.log(chalk.dim(`Refreshing every ${opts.interval}s — Ctrl+C to stop`));
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
      console.error(chalk.red(`Agent '${id}' exists`));
      process.exit(1);
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
    console.log(chalk.green(`✓ Agent '${id}' created`));
    console.log(chalk.dim(`  morv run -a ${id} "Scan Base and DCA if dip detected"`));
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
  .action((agentId?: string) => {
    const config = loadConfig();
    const id = resolveAgentId(config, agentId);
    const policy = (getAgentConfig(config, id)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
    const guard = new AgentGuard({ agentId: id, wallet: new MockWallet(), policy, dbPath: dbPath() });
    const s = guard.status();
    console.log(chalk.bold(`\nAgentGuard — ${s.agentId}`));
    console.log(`  ${s.isPaused ? chalk.red('PAUSED') : chalk.green('ACTIVE')}`);
    console.log(`  Spent: $${s.spentTodayUsd} / $${s.policy.dailyLimitUsd}`);
    console.log(`  Remaining: $${s.policy.dailyRemainingUsd}`);
    guard.destroy();
  });

guardCmd.command('pause <agentId>').action((agentId: string) => {
  const config = loadConfig();
  const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
  const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
  guard.pause('Manual pause via CLI');
  guard.destroy();
  console.log(chalk.yellow(`⏸ ${agentId} paused`));
});

guardCmd.command('resume <agentId>').action((agentId: string) => {
  const config = loadConfig();
  const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
  const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
  guard.resume();
  guard.destroy();
  console.log(chalk.green(`▶ ${agentId} resumed`));
});

guardCmd
  .command('history <agentId>')
  .option('-n, --limit <n>', 'Limit', '10')
  .action((agentId: string, opts: { limit: string }) => {
    const config = loadConfig();
    const policy = (getAgentConfig(config, agentId)?.policy ?? DEFAULT_POLICY) as PolicyConfig;
    const guard = new AgentGuard({ agentId, wallet: new MockWallet(), policy, dbPath: dbPath() });
    guard.history(parseInt(opts.limit, 10)).forEach((tx) => {
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
      marketplaceUrl: config.marketplaceUrl ?? 'http://localhost:3001/marketplace',
    });
    const result = await morv.searchMarketplace(query);
    result.tools.forEach((t) => {
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
  const morv = new MorvClient({ apiKey: config.apiKey, apiBaseUrl: config.apiBaseUrl ?? 'http://localhost:3001' });
  console.log(JSON.stringify(await morv.billing.getUsage(), null, 2));
});

billingCmd.command('statement').action(async () => {
  const config = loadConfig();
  const morv = new MorvClient({ apiKey: config.apiKey, apiBaseUrl: config.apiBaseUrl ?? 'http://localhost:3001' });
  console.log(JSON.stringify(await morv.billing.getStatement(), null, 2));
});

program.parse();
