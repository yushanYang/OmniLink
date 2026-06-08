import http from "node:http";
import { createButler, createMockRuntime, DeviceRouter } from "./index.js";
import { loadEnv } from "./env.js";

loadEnv();

const PORT = Number(process.env.AI_PORT || 8787);
const HOST = process.env.AI_HOST || "0.0.0.0";

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
        mode: process.env.AI_MODE || "auto",
        openaiKeyConfigured: hasUsableApiKey(process.env.OPENAI_API_KEY),
      });
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
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Chat:   POST http://localhost:${PORT}/chat`);
});

async function handleChat(body) {
  const devices = Array.isArray(body.devices) ? body.devices : undefined;
  const runtime = createMockRuntime({ devices });
  const router = new DeviceRouter(runtime);
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
