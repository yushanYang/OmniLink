/**
 * OmniLink AI butler entrypoint: natural language -> tool calls -> router.
 */
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { planLocalToolCalls, summarizeLocalReply } from "./local-planner.js";
import { DeviceRouter } from "./router.js";
import { deviceTools, SYSTEM_PROMPT } from "./tools.js";

export { DeviceRouter, deviceTools, SYSTEM_PROMPT };
export { createMockRuntime } from "./mock-runtime.js";

/**
 * @param {object} opts
 * @param {DeviceRouter} opts.router
 * @param {string} [opts.apiKey]
 * @param {string} [opts.baseURL]
 * @param {string} [opts.model]
 * @param {"auto"|"openai"|"local"} [opts.mode]
 */
export function createButler({ router, apiKey, baseURL, model, mode = "auto" }) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;
  const useOpenAI = mode === "openai" || (mode === "auto" && hasUsableApiKey(resolvedApiKey));
  const forceOpenAI = mode === "openai";
  const chatModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const clientPromise = useOpenAI
    ? createOpenAIClient({ apiKey: resolvedApiKey, baseURL: baseURL || process.env.OPENAI_BASE_URL })
    : null;

  const history = [{ role: "system", content: SYSTEM_PROMPT }];

  async function chat(userText, context = {}) {
    const result = await chatDetailed(userText, context);
    return result.reply;
  }

  async function chatDetailed(userText, context = {}) {
    if (clientPromise) {
      try {
        const client = await clientPromise;
        return await chatWithOpenAI({ client, chatModel, history, router, userText, context });
      } catch (error) {
        if (forceOpenAI) throw error;
        const local = await chatWithLocalPlanner({ router, userText, context });
        return {
          ...local,
          fallbackReason: error.message,
        };
      }
    }
    return chatWithLocalPlanner({ router, userText, context });
  }

  return {
    chat,
    chatDetailed,
    history,
    mode: useOpenAI ? "openai" : "local",
    model: useOpenAI ? chatModel : "local-planner",
  };
}

async function chatWithOpenAI({ client, chatModel, history, router, userText, context }) {
  const toolResults = [];
  const toolCalls = [];
  history.push({ role: "user", content: userText });

  let response = await client.chat.completions.create({
    model: chatModel,
    messages: history,
    tools: deviceTools,
    tool_choice: "required",
  });

  let msg = response.choices[0].message;
  history.push(msg);

  while (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const call of msg.tool_calls) {
      const args = safeJsonParse(call.function.arguments);
      const result = await router.handleToolCall(call.function.name, args, context);
      const normalizedCall = { name: call.function.name, args };
      toolCalls.push(normalizedCall);
      toolResults.push({ ...normalizedCall, result });
      history.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    response = await client.chat.completions.create({
      model: chatModel,
      messages: history,
      tools: deviceTools,
    });
    msg = response.choices[0].message;
    history.push(msg);
  }

  const guardrail = await runLocalGuardrailIfNeeded({
    router,
    userText,
    context,
    toolCalls,
    toolResults,
  });

  return {
    ok: true,
    reply: guardrail.reply ?? msg.content ?? "",
    toolCalls,
    toolResults,
    source: guardrail.used ? "openai+local-guard" : "openai",
    model: chatModel,
  };
}

async function chatWithLocalPlanner({ router, userText, context }) {
  const plannerContext = {
    ...context,
    listDevices: (ctx) => router.listDevices(ctx),
  };
  const plannedCalls = await planLocalToolCalls(userText, plannerContext);
  const toolResults = [];

  for (const call of plannedCalls) {
    const result = await router.handleToolCall(call.name, call.args, context);
    toolResults.push({ name: call.name, args: call.args, result });
  }

  return {
    ok: true,
    reply: summarizeLocalReply({ message: userText, toolResults }),
    toolCalls: plannedCalls,
    toolResults,
    source: "local-planner",
    model: "local-planner",
  };
}

function hasUsableApiKey(apiKey) {
  return Boolean(apiKey && apiKey !== "your_openai_api_key_here");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

async function runLocalGuardrailIfNeeded({ router, userText, context, toolCalls, toolResults }) {
  const alreadyControlled = toolCalls.some((call) => call.name === "control_device" || call.name === "grant_access");
  if (alreadyControlled) return { used: false };

  const plannedCalls = await planLocalToolCalls(userText, {
    ...context,
    listDevices: (ctx) => router.listDevices(ctx),
  });
  const actionable = plannedCalls.filter((call) => call.name === "control_device" || call.name === "grant_access");
  if (actionable.length === 0) return { used: false };

  const guardResults = [];
  for (const call of actionable) {
    const result = await router.handleToolCall(call.name, call.args, context);
    toolCalls.push(call);
    const toolResult = { name: call.name, args: call.args, result };
    toolResults.push(toolResult);
    guardResults.push(toolResult);
  }

  return {
    used: true,
    reply: summarizeLocalReply({ message: userText, toolResults: guardResults }),
  };
}

async function createOpenAIClient({ apiKey, baseURL }) {
  const endpoint = `${(baseURL || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`;

  return {
    chat: {
      completions: {
        create: async (body) => {
          const payload = await postJson(endpoint, body, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            }
          });
          if (!Array.isArray(payload?.choices)) {
            const detail = payload?.error?.message || payload?.message || "missing choices in API response";
            throw new Error(detail);
          }
          return payload;
        },
      },
    },
  };
}

function postJson(endpoint, body, { headers = {} } = {}) {
  const url = new URL(endpoint);
  const payload = JSON.stringify(body);
  const proxyUrl = getProxyUrl(url);

  if (proxyUrl && url.protocol === "https:") {
    return postJsonViaHttpsProxy({ url, payload, headers, proxyUrl });
  }

  return postJsonDirect({ url, payload, headers });
}

function postJsonDirect({ url, payload, headers }) {
  const transport = url.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      method: "POST",
      hostname: url.hostname,
      port: url.port || (url.protocol === "http:" ? 80 : 443),
      path: `${url.pathname}${url.search}`,
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
    }, (res) => collectResponse(res, resolve, reject));

    req.on("timeout", () => req.destroy(new Error("OpenAI API request timed out")));
    req.on("error", reject);
    req.end(payload);
  });
}

function postJsonViaHttpsProxy({ url, payload, headers, proxyUrl }) {
  const proxy = new URL(proxyUrl);
  const targetPort = Number(url.port || 443);

  return new Promise((resolve, reject) => {
    const connectHeaders = {};
    if (proxy.username || proxy.password) {
      const auth = Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64");
      connectHeaders["Proxy-Authorization"] = `Basic ${auth}`;
    }

    const connectReq = http.request({
      method: "CONNECT",
      hostname: proxy.hostname,
      port: Number(proxy.port || 8080),
      path: `${url.hostname}:${targetPort}`,
      headers: connectHeaders,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
    });

    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`proxy CONNECT failed with HTTP ${res.statusCode}`));
        return;
      }

      const tlsSocket = tls.connect({ socket, servername: url.hostname }, () => {
        const requestHead = [
          `POST ${url.pathname}${url.search} HTTP/1.1`,
          `Host: ${url.hostname}`,
          ...Object.entries({
            ...headers,
            "Content-Length": Buffer.byteLength(payload),
            Connection: "close",
          }).map(([key, value]) => `${key}: ${value}`),
          "",
          "",
        ].join("\r\n");

        tlsSocket.write(requestHead);
        tlsSocket.write(payload);
      });

      collectRawHttpResponse(tlsSocket, resolve, reject);
    });

    connectReq.on("timeout", () => connectReq.destroy(new Error("OpenAI proxy CONNECT timed out")));
    connectReq.on("error", reject);
    connectReq.end();
  });
}

function collectResponse(res, resolve, reject) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    handleJsonResponse({ statusCode: res.statusCode, raw, resolve, reject });
  });
}

function collectRawHttpResponse(socket, resolve, reject) {
  const chunks = [];
  socket.on("data", (chunk) => chunks.push(chunk));
  socket.on("end", () => {
    const rawResponse = Buffer.concat(chunks).toString("utf8");
    const headerEnd = rawResponse.indexOf("\r\n\r\n");
    const header = rawResponse.slice(0, headerEnd);
    const rawBody = rawResponse.slice(headerEnd + 4);
    const statusCode = Number(header.match(/^HTTP\/\d\.\d\s+(\d+)/)?.[1] ?? 0);
    const raw = /transfer-encoding:\s*chunked/i.test(header) ? decodeChunkedBody(rawBody) : rawBody;
    handleJsonResponse({ statusCode, raw, resolve, reject });
  });
  socket.on("error", reject);
}

function handleJsonResponse({ statusCode, raw, resolve, reject }) {
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (statusCode < 200 || statusCode >= 300) {
    reject(new Error(parsed?.error?.message || `OpenAI API HTTP ${statusCode}`));
    return;
  }

  resolve(parsed);
}

function getProxyUrl(url) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || "";
  if (noProxy.split(",").map((item) => item.trim()).some((item) => item && url.hostname.endsWith(item))) {
    return "";
  }

  return process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || "";
}

function decodeChunkedBody(rawBody) {
  let index = 0;
  let decoded = "";

  while (index < rawBody.length) {
    const lineEnd = rawBody.indexOf("\r\n", index);
    if (lineEnd === -1) break;

    const sizeText = rawBody.slice(index, lineEnd).split(";")[0];
    const size = Number.parseInt(sizeText, 16);
    if (!Number.isFinite(size) || size < 0) break;
    if (size === 0) break;

    const chunkStart = lineEnd + 2;
    decoded += rawBody.slice(chunkStart, chunkStart + size);
    index = chunkStart + size + 2;
  }

  return decoded || rawBody;
}
