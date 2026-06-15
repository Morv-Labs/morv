/**
 * Base Mainnet production example
 *
 * Setup:
 *   cp .env.example .env
 *   # Set MORV_WALLET_PRIVATE_KEY (wallet with USDC on Base)
 *
 * Run:
 *   npx tsx examples/base-mainnet.ts
 */

import { AgentGuard, createWalletFromEnv, USDC_BASE_MAINNET } from 'morv';

async function main() {
  console.log('USDC contract (Base mainnet):', USDC_BASE_MAINNET);

  const wallet = createWalletFromEnv();
  console.log('Wallet:', wallet.getAddress?.());
  console.log('Balance:', await wallet.getBalance?.(), 'USDC');

  const guard = new AgentGuard({
    agentId: 'base-prod-agent',
    wallet,
    policy: {
      dailyLimitUsd: 50,
      perTxLimitUsd: 5,
      autoPause: true,
    },
    dbPath: ':memory:',
  });

  // Replace with your service address
  const SERVICE = process.env.PAYMENT_RECIPIENT ?? wallet.getAddress!();

  console.log('\nSending $0.01 USDC (test)...');
  const result = await guard.pay({
    to: SERVICE,
    amount: 0.01,
    currency: 'USDC',
    memo: 'Morv Base mainnet test',
    category: 'api',
  });

  console.log('Tx hash:', result.txHash);
  console.log('Status:', guard.status());

  guard.destroy();
}

main().catch(console.error);
