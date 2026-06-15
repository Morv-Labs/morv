/**
 * Morv Labs — Full Platform Demo
 * Run: npx tsx examples/full-platform.ts
 */

import { MorvClient, MockWallet, PolicyViolationError } from 'morv';

async function main() {
  console.log('=== Morv Labs — Full Platform Demo ===\n');

  const morv = new MorvClient({
    apiBaseUrl: 'http://localhost:3001',
    dbPath: ':memory:',
  });

  const wallet = new MockWallet({ balanceUsd: 100 });

  // createAgent = BYOM + MCP tools + AgentGuard (all in one)
  const agent = await morv.createAgent(
    {
      id: 'demo-agent',
      model: { provider: 'ollama', model: 'llama3', baseUrl: 'http://localhost:11434' },
      policy: { dailyLimitUsd: 50, perTxLimitUsd: 10, autoPause: true },
      tools: ['eth-price'], // MCP — requires backend running
    },
    wallet
  );

  console.log('── Layer 1: AgentGuard (security) ──');
  const pay = await agent.pay({
    to: '0xService00000000000000000000000000000001',
    amount: 5,
    currency: 'USDC',
    category: 'api',
    memo: 'test payment',
  });
  console.log(`  ✓ Payment approved: ${pay.txHash}`);

  console.log('\n── Layer 2: MCP Tool (via gateway) ──');
  try {
    const toolResult = await agent.useTool('eth-price', {});
    console.log(`  ✓ ETH price:`, toolResult.output);
  } catch (err) {
    console.log(`  ⚠ MCP needs backend: ${err}`);
  }

  console.log('\n── Layer 3: AgentGuard blocks over-limit ──');
  try {
    await agent.pay({ to: '0xBad', amount: 99, currency: 'USDC' });
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      console.log(`  ✓ Blocked: ${err.reason}`);
    }
  }

  console.log('\n── Status ──');
  console.log(JSON.stringify(agent.status(), null, 2));

  agent.guard.destroy();
  console.log('\n=== AgentGuard is ONE module. MCP + x402 + BYOM = the full Morv platform. ===');
}

main().catch(console.error);
