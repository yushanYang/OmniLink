# OmniLink Backend API Implementation Guide

This guide is for backend/device/AI teammates implementing services consumed by `packages/web`.

Canonical frontend contract:

- `docs/api-contracts.md`
- `packages/web/.env.example`

## Local Service Ports

Use these defaults unless the team agrees otherwise:

| Service | Owner | Env var used by Web | Local URL |
| --- | --- | --- | --- |
| Registry / Contract API | good person | `VITE_OMNILINK_REGISTRY_API` | `http://127.0.0.1:7001` |
| Device / P2P API | hill son | `VITE_OMNILINK_PEER_API` | `http://127.0.0.1:7002` |
| AI Agent API | Russssty | `VITE_OMNILINK_AI_API` | `http://127.0.0.1:7003` |

Frontend `.env.local` example:

```bash
VITE_OMNILINK_REGISTRY_API=http://127.0.0.1:7001
VITE_OMNILINK_PEER_API=http://127.0.0.1:7002
VITE_OMNILINK_AI_API=http://127.0.0.1:7003
```

## Backend Requirements

All services should:

- Return JSON.
- Enable CORS for `http://127.0.0.1:5173` and `http://localhost:5173`.
- Accept `Content-Type: application/json`.
- Return `2xx` for successful demo responses.
- Implement `GET /health` for the frontend integration console.
- Return a JSON error for failures:

```json
{
  "error": "Short human-readable error",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

### `GET /health`

All three services should expose this endpoint.

Response:

```json
{
  "ok": true,
  "service": "registry-api"
}
```

## Registry / Contract API

Base URL: `http://127.0.0.1:7001`

### `GET /devices`

Purpose: Let Web render available demo devices.

Response:

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

### `POST /access/check`

Purpose: Check whether `walletAddress` can control `deviceId`.

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

### `POST /access/grant`

Purpose: Grant temporary access on-chain or mock the transaction during early integration.

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

## Device / P2P API

Base URL: `http://127.0.0.1:7002`

### `POST /commands`

Purpose: Send a control command to a virtual or real device.

Supported demo actions:

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

## AI Agent API

Base URL: `http://127.0.0.1:7003`

### `POST /chat`

Purpose: Convert a natural language request into a reply and optional tool call.

Request:

```json
{
  "message": "帮我打开实验室门锁",
  "devices": [
    {
      "id": "lock-lab-001",
      "name": "Lab Door Lock",
      "type": "Smart Lock",
      "status": "online",
      "access": "granted"
    }
  ]
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

`toolCall` can be omitted when the agent only wants to answer text.

## Minimal Express Stub

This is a quick reference for any teammate who wants to stand up a local service fast.

```js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "omnilink-stub" });
});

app.get("/devices", (_req, res) => {
  res.json({
    devices: [
      {
        id: "lock-lab-001",
        name: "Lab Door Lock",
        type: "Smart Lock",
        owner: "TP5x...91aC",
        status: "online",
        access: "granted",
        expiresAt: "2026-06-04 23:59",
        connection: "p2p-ready",
        lastEvent: "Local backend stub",
      },
    ],
  });
});

app.post("/access/check", (req, res) => {
  res.json({ allowed: true, expiresAt: "2026-06-04 23:59" });
});

app.post("/access/grant", (req, res) => {
  res.json({ ok: true, txId: `stub-tx-${Date.now()}` });
});

app.post("/commands", (req, res) => {
  res.json({
    ok: true,
    requestId: `req-${Date.now()}`,
    deviceId: req.body.deviceId,
    action: req.body.action,
    transport: "stub-http",
    receivedAt: new Date().toLocaleTimeString(),
  });
});

app.post("/chat", (req, res) => {
  res.json({
    reply: "I will unlock the lab door.",
    toolCall: {
      name: "sendDeviceCommand",
      arguments: {
        deviceId: "lock-lab-001",
        action: "unlock",
      },
    },
  });
});

app.listen(7001, "127.0.0.1", () => {
  console.log("OmniLink stub listening on http://127.0.0.1:7001");
});
```

For separate services, keep only the endpoints owned by that service and change the port.

## Frontend联调 Steps

1. Backend starts the service.
2. Web creates `packages/web/.env.local` with the matching URL.
3. Restart Web dev server after changing env values.
4. Open `http://127.0.0.1:5173`.
5. Confirm top-right status changes from `Mock mode` to `API mode`.
6. Click through: connect wallet -> check access -> grant -> unlock -> ask Agent -> run suggested tool.

If a service fails, Web falls back to mock behavior and logs the error in the browser console.
