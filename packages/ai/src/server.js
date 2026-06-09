import http from "node:http";
import { createButler, createMockRuntime, DeviceRouter } from "./index.js";
import { createPersistentP2PExecutor } from "./p2p-persistent.js";
import { createChainRuntime, isChainConfigured } from "./chain-runtime.js";
import { loadEnv } from "./env.js";

loadEnv();

const PORT = Number(process.env.AI_PORT || 8787);
const HOST = process.env.AI_HOST || "0.0.0.0";

// AI_EXECUTOR=p2p 时使用真实 WebRTC P2P 下发；否则走 mock
const USE_P2P = (process.env.AI_EXECUTOR || "mock").toLowerCase() === "p2p";
// 持久 P2P 直连：首次握手后保持 DataChannel，命令 <50ms 送达
const p2pExecutor = USE_P2P ? createPersistentP2PExecutor({
  signalingUrl: process.env.SIGNALING_URL || "ws://localhost:8080",
  connectTimeoutMs: Number(process.env.AI_P2P_CONNECT_TIMEOUT || 10000),
  commandTimeoutMs: Number(process.env.AI_P2P_CMD_TIMEOUT || 5000),
}) : null;

// Chain runtime: auto-detect if DEVICE_REGISTRY_ADDRESS is configured
const USE_CHAIN = isChainConfigured();
let chainRuntime = null;

if (USE_CHAIN) {
  createChainRuntime().then(rt => {
    chainRuntime = rt;
    console.log("⛓️  Chain runtime ready (TRON DeviceRegistry)");
  }).catch(err => {
    console.warn("⚠️  Chain runtime init failed, falling back to mock:", err.message);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "OmniLink AI API",
        chain: USE_CHAIN ? "tron-nile" : "mock",
        executor: USE_P2P ? "p2p" : "mock",
        mode: process.env.AI_MODE || "auto",
        openaiKeyConfigured: hasUsableApiKey(process.env.OPENAI_API_KEY),
      });
      return;
    }

    if (req.method === "GET" && req.url === "/devices") {
      const rt = chainRuntime || createMockRuntime();
      const devices = await rt.listDevices({ userAddress: "demo-owner" });
      sendJson(res, 200, { ok: true, devices });
      return;
    }

    if (req.method === "POST" && req.url === "/access/check") {
      const body = await readJson(req);
      const rt = chainRuntime || createMockRuntime();
      const allowed = await rt.checkAccess(body.deviceId, body.walletAddress);
      sendJson(res, 200, { ok: true, allowed, walletAddress: body.walletAddress, deviceId: body.deviceId, expiresAt: allowed ? "permanent" : null, source: chainRuntime ? "chain" : "mock" });
      return;
    }

    if (req.method === "POST" && req.url === "/access/grant") {
      const body = await readJson(req);
      const rt = chainRuntime || createMockRuntime();
      const result = await rt.grantAccess({ deviceId: body.deviceId, userAddress: body.walletAddress, durationHours: body.durationHours });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === "POST" && req.url === "/commands") {
      const body = await readJson(req);
      const { deviceId, action } = body;
      if (!deviceId || !action) {
        sendJson(res, 400, { ok: false, error: "missing deviceId or action" });
        return;
      }
      if (USE_P2P) {
        const result = await p2pExecutor(deviceId, { action });
        sendJson(res, 200, { ok: true, ...result });
      } else {
        const runtime = createMockRuntime();
        const result = await runtime.executor(deviceId, { action });
        sendJson(res, 200, result);
      }
      return;
    }

    if (req.method === "POST" && req.url === "/chat") {
      const body = await readJson(req);
      const response = await handleChat(body);
      sendJson(res, 200, response);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`OmniLink AI API listening on http://${HOST}:${PORT}`);
  console.log(`Executor: ${USE_P2P ? "P2P (WebRTC via signaling)" : "Mock (in-memory)"}`);
  console.log(`Chain: ${USE_CHAIN ? "TRON (DeviceRegistry)" : "Mock (in-memory)"}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Chat:   POST http://localhost:${PORT}/chat`);
});

async function handleChat(body) {
  const devices = Array.isArray(body.devices) ? body.devices : undefined;
  const runtime = createMockRuntime({ devices });

  // P2P 模式：用真实 executor 替换 mock executor，其余保持 mock runtime
  const routerOpts = USE_P2P
    ? {
        // If chain runtime is available, use its checkAccess and listDevices
        ...(chainRuntime ? { listDevices: chainRuntime.listDevices, checkAccess: chainRuntime.checkAccess, grantAccess: chainRuntime.grantAccess } : {}),
        ...runtime,
        // Override with chain if available (spread order: chain overrides mock)
        ...(chainRuntime ? { listDevices: chainRuntime.listDevices, checkAccess: chainRuntime.checkAccess, grantAccess: chainRuntime.grantAccess } : {}),
        executor: async (deviceId, command, context) => {
          console.log(`[p2p] sending ${command.action} to ${deviceId}`);
          return p2pExecutor(deviceId, command);
        },
      }
    : runtime;

  // Non-P2P mode: also overlay chain if available
  const finalOpts = (!USE_P2P && chainRuntime) ? { ...routerOpts, listDevices: chainRuntime.listDevices, checkAccess: chainRuntime.checkAccess, grantAccess: chainRuntime.grantAccess } : routerOpts;

  const router = new DeviceRouter(finalOpts);
  const butler = createButler({
    router,
    mode: process.env.AI_MODE || "auto",
  });

  const result = await butler.chatDetailed(body.message ?? "", {
    userAddress: body.account ?? body.userAddress ?? "demo-owner",
    sessionId: body.sessionId,
    devices,
  });

  return {
    ok: true,
    sessionId: body.sessionId ?? "demo-session",
    reply: result.reply,
    toolCall: toWebToolCall(result.toolResults),
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    source: result.source,
    model: result.model,
    fallbackReason: result.fallbackReason,
  };
}

function toWebToolCall(toolResults = []) {
  const control = toolResults.find((item) => item.name === "control_device" && item.result?.ok === true);
  if (!control) return null;
  const { deviceId, action, value } = control.args;
  return {
    name: "sendDeviceCommand",
    arguments: {
      deviceId,
      action,
      value,
    },
  };
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function hasUsableApiKey(apiKey) {
  return Boolean(apiKey && apiKey !== "your_openai_api_key_here");
}
