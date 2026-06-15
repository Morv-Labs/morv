/**
 * Morv SDK — Basic Usage Example
 *
 * Run: npx tsx examples/basic-usage.ts
 */

import {
  MorvClient,
  MockWallet,
  PolicyViolationError,
  McpRegistry,
} from 'morv';

async function main() {
  console.log('=== Morv Labs — AgentGuard Demo ===\n');

  const wallet = new MockWallet({ balanceUsd: 100 });
  const morv = new MorvClient({ dbPath: ':memory:' });

  const agent = morv.createAgent(
    {
      id: 'demo-agent',
      model: { provider: 'ollama', model: 'llama3' },
      policy: {
        dailyLimitUsd: 50,
        perTxLimitUsd: 10,
        autoPause: true,
        categoryLimits: { mcp: 20, api: 30 },
      },
    },
    wallet
  );

  // Register a free local MCP tool
  const mcp = agent.mcp;
  mcp.register({
    id: 'hello-tool',
    name: 'Hello Tool',
    description: 'Returns a greeting',
    version: '1.0.0',
    author: 'Morv Labs',
    category: 'developer',
    pricing: { type: 'free' },
    endpoint: 'http://localhost:3001/tools/sentiment/execute',
    schema: { input: { name: { type: 'string' } }, output: { greeting: { type: 'string' } } },
    tags: ['demo'],
    verified: true,
  });

  console.log('1. Approved payment ($5)...');
  const result = await agent.pay({
    to: '0xServiceProvider1234567890123456789012345678',
    amount: 5,
    currency: 'USDC',
    memo: 'API call: data feed',
    category: 'api',
  });
  console.log(`   ✓ Tx: ${result.txHash}\n`);

  console.log('2. Blocked payment ($25 > $10 limit)...');
  try {
    await agent.pay({
      to: '0xServiceProvider1234567890123456789012345678',
      amount: 25,
      currency: 'USDC',
    });
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      console.log(`   ✗ Blocked: ${err.reason}\n`);
    }
  }

  console.log('3. Agent status:');
  const status = agent.status();
  console.log(`   Spent today: $${status.spentTodayUsd}`);
  console.log(`   Remaining:   $${status.policy.dailyRemainingUsd}`);
  console.log(`   Paused:      ${status.isPaused}\n`);

  console.log('4. Transaction history:');
  agent.history(5).forEach((tx) => {
    console.log(`   [${tx.status}] $${tx.amountUsd} → ${tx.toAddress.slice(0, 12)}...`);
  });

  console.log('\n=== Demo complete ===');
  agent.guard.destroy();
}

main().catch(console.error);
