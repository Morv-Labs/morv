# Security

## Reporting

If you discover a security issue, contact the team via [morv.run](https://morv.run) or DM [@morvlabs](https://x.com/morvlabs) on X.

Please do not open public issues for undisclosed vulnerabilities.

## Agent operators

- Never commit `.env`, private keys, or API keys to git
- Use AgentGuard policies on every agent — set conservative `dailyLimitUsd` and `perTxLimitUsd`
- Prefer dedicated wallets with limited USDC balance for agent operations
- Rotate API keys if exposed

## Dependencies

Run `npm audit` before production deployments. Pin SDK version in your project:

```json
"@morv-labs/morv": "0.1.0"
```
