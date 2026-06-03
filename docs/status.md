# Current Status

## Today

- [x] Scaffold Web frontend package.
- [x] Add mock device registry data.
- [x] Add TronLink-first wallet adapter with mock fallback.
- [x] Add device control actions through a mock P2P adapter.
- [x] Add Agent UI with mock function-calling output.
- [x] Add env-driven API mode with mock fallback.
- [x] Add frontend API contract document.
- [x] Add backend API implementation guide.
- [x] Add integration console with service health checks.
- [x] Add one-click demo flow runner.
- [x] Add Chinese/English language switcher with Chinese as default.
- [ ] Replace mock adapters with team-owned contract, P2P, and AI APIs when service URLs are ready.

## Integration Contracts Needed

| Area | Owner | Needed by Web |
| --- | --- | --- |
| Contract | good person | ABI path, Nile contract address, `checkAccess`, `grantAccess` call shape |
| Device/P2P | hill son | signaling server URL, `deviceId`, command JSON schema |
| AI Agent | Russssty | chat endpoint, function-call response format |

## API Contract

- `docs/api-contracts.md`
- `docs/backend-api-implementation.md`
- `packages/web/.env.example`

## Web Mock Adapter Files

- `packages/web/src/lib/config.js`
- `packages/web/src/lib/health.js`
- `packages/web/src/lib/http.js`
- `packages/web/src/lib/i18n.js`
- `packages/web/src/lib/wallet.js`
- `packages/web/src/lib/registry.js`
- `packages/web/src/lib/peer.js`
- `packages/web/src/lib/aiClient.js`
