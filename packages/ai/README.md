# @omnilink/ai

OmniLink AI butler layer: natural language -> Function Calling/local planning -> authorization check -> device command routing.

This package is now usable before the chain/P2P modules are fully ready:

- `DeviceRouter` is adapter-driven.
- `createMockRuntime()` provides mock devices, mock access control, and mock execution.
- `createButler()` uses OpenAI Function Calling when `OPENAI_API_KEY` is configured.
- The OpenAI call uses Node's built-in `fetch`, so the API path does not depend on installing the `openai` package.
- Without an OpenAI key, it falls back to a deterministic local planner so demos still run.
- `src/server.js` exposes the web-facing AI API.

## Run CLI Demo

```bash
npm run start -w @omnilink/ai
```

Try:

```txt
lock the lab door
unlock the lab door
what devices do I have
turn on the booth light
grant visitor access to the booth light
```

## Run AI API For Web

```bash
npm run ai:serve
```

Real LLM mode:

```bash
OPENAI_API_KEY=sk-...
AI_MODE=auto
npm run ai:serve
```

Strict real LLM mode, useful for checking whether the API is actually connected:

```bash
OPENAI_API_KEY=sk-...
AI_MODE=openai
npm run ai:serve
```

`AI_MODE=auto` tries OpenAI first when a key exists and falls back to `local-planner` if the API is unavailable. `AI_MODE=openai` does not fallback.

Then set the web env var:

```bash
VITE_OMNILINK_AI_API=http://localhost:8787
npm run web
```

Health:

```http
GET http://localhost:8787/health
```

Chat:

```http
POST http://localhost:8787/chat
Content-Type: application/json
```

```json
{
  "message": "Unlock Lab Door Lock",
  "account": "demo-owner",
  "devices": [
    {
      "id": "lock-lab-001",
      "name": "Lab Door Lock",
      "type": "Smart Lock",
      "access": "granted",
      "status": "online"
    }
  ]
}
```

Response shape:

```json
{
  "ok": true,
  "reply": "Done: unlock was sent to lock-lab-001.",
  "toolCall": {
    "name": "sendDeviceCommand",
    "arguments": {
      "deviceId": "lock-lab-001",
      "action": "unlock"
    }
  },
  "toolResults": [
    {
      "name": "control_device",
      "args": {
        "deviceId": "lock-lab-001",
        "action": "unlock"
      },
      "result": {
        "ok": true
      }
    }
  ],
  "source": "local-planner",
  "model": "local-planner"
}
```

## Adapter Contract

```js
new DeviceRouter({
  listDevices: async (context) => devices,
  checkAccess: async (deviceId, userAddress, context) => true,
  executor: async (deviceId, { action, value }, context) => result,
  grantAccess: async (args, context) => result,
});
```

Current mock adapters can be replaced later:

- `checkAccess` -> `DeviceRegistry.checkAccess(deviceId, userAddress)`
- `executor` -> `createP2PExecutor({ signalingUrl })`
- `listDevices` -> chain registry discovery or web-provided device context

## Real P2P Hook

The real P2P executor lives in `src/p2p-executor.js` and speaks the current device protocol:

```js
{ "type": "command", "requestId": "...", "command": { "action": "unlock" } }
```

It waits for:

```js
{ "type": "result", "requestId": "...", "ok": true }
```

Use it after `packages/device` signaling and virtual lock are running.
