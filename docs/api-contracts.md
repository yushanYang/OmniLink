# OmniLink Web API Contracts

This document is the current frontend integration contract for OmniLink. The Web app can run in mock mode with no services, or API mode when one or more environment URLs are configured.

## Runtime Configuration

Create `packages/web/.env.local` from `packages/web/.env.example`.

```bash
VITE_OMNILINK_REGISTRY_API=http://127.0.0.1:7001
VITE_OMNILINK_PEER_API=http://127.0.0.1:7002
VITE_OMNILINK_AI_API=http://127.0.0.1:7003
```

All URLs are optional. Empty values keep that adapter in mock mode.

## Service Health

Every configured backend service should expose `GET /health` so the Web integration console can show `connected` or `failed`.

Response:

```json
{
  "ok": true,
  "service": "registry-api"
}
```

## Shared Device Shape

```json
{
  "id": "lock-lab-001",
  "name": "Lab Door Lock",
  "type": "Smart Lock",
  "owner": "TP5x...91aC",
  "status": "online",
  "access": "granted",
  "expiresAt": "2026-06-04 23:59",
  "connection": "p2p-ready",
  "lastEvent": "Locked by device heartbeat"
}
```

Required enum values:

- `status`: `online` or `offline`
- `access`: `granted`, `pending`, or `expired`

## Registry / Contract Adapter

Base URL: `VITE_OMNILINK_REGISTRY_API`

Owner: good person

### GET `/devices`

Response can be either an array or an object with `devices`.

```json
{
  "devices": [
    {
      "id": "lock-lab-001",
      "name": "Lab Door Lock",
      "type": "Smart Lock",
      "owner": "TP5x...91aC",
      "status": "online",
      "access": "granted",
      "expiresAt": "2026-06-04 23:59",
      "connection": "p2p-ready",
      "lastEvent": "Registered on Nile"
    }
  ]
}
```

### POST `/access/check`

Request:

```json
{
  "walletAddress": "TMock8JbQWj5rG9A4Demo",
  "deviceId": "lock-lab-001"
}
```

Response:

```json
{
  "allowed": true,
  "expiresAt": "2026-06-04 23:59"
}
```

### POST `/access/grant`

Request:

```json
{
  "walletAddress": "TMock8JbQWj5rG9A4Demo",
  "deviceId": "lock-lab-001",
  "durationHours": 24
}
```

Response:

```json
{
  "ok": true,
  "txId": "0xabc123"
}
```

## Device / P2P Adapter

Base URL: `VITE_OMNILINK_PEER_API`

Owner: hill son

### POST `/commands`

Supported `action` values for the demo:

- `unlock`
- `lock`
- `turn_on`
- `turn_off`

Request:

```json
{
  "deviceId": "lock-lab-001",
  "action": "unlock"
}
```

Response:

```json
{
  "ok": true,
  "requestId": "req-001",
  "deviceId": "lock-lab-001",
  "action": "unlock",
  "transport": "webrtc-p2p",
  "receivedAt": "14:20:00"
}
```

## AI Agent Adapter

Base URL: `VITE_OMNILINK_AI_API`

Owner: Russssty

### POST `/chat`

Request:

```json
{
  "message": "帮我打开实验室门锁",
  "devices": []
}
```

Response:

```json
{
  "reply": "I will unlock the lab door.",
  "toolCall": {
    "name": "sendDeviceCommand",
    "arguments": {
      "deviceId": "lock-lab-001",
      "action": "unlock"
    }
  }
}
```

`toolCall` is optional. If present and `name` is `sendDeviceCommand`, the frontend passes `arguments` to the P2P adapter.

## Frontend Fallback Rule

If an API URL is empty, the matching adapter uses mock data. If an API URL is configured but the request fails, the frontend logs the failure in the console, uses mock fallback behavior, and keeps the demo path alive.
