/**
 * WebSocket 命令执行器 — 通过 signaling server 直接中转命令。
 *
 * 真实产品架构：
 *   设备端保持和 signaling 的长连接（心跳保活）
 *   App/AI 通过同一 signaling 向设备房间发消息
 *   signaling 做同房间消息中转（与 P2P 握手信令共用通道）
 *
 * 优势：
 *   - 无 WebRTC 握手延迟（<100ms）
 *   - 设备端无需重建连接，始终在线
 *   - 可同时操作多设备（每设备一个 ws 长连接）
 *   - AI server 重启后自动恢复
 *
 * 局域网/Demo 下与 WebRTC DataChannel 逻辑一致：
 *   设备收到 {type:"command"} → 执行 → 回复 {type:"result"}
 *   区别仅是传输层（ws 中转 vs WebRTC 直连）
 */
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

export function createWSExecutor({
  signalingUrl = process.env.SIGNALING_URL || "ws://localhost:8080",
  timeoutMs = Number(process.env.AI_WS_TIMEOUT_MS || 6000),
} = {}) {
  // 持久连接池：deviceId -> { ws, pending }
  const connections = new Map();

  return async function executeOverWS(deviceId, command) {
    const conn = getOrCreateConnection(deviceId);
    return sendCommand(conn, deviceId, command, timeoutMs);
  };

  function getOrCreateConnection(deviceId) {
    if (connections.has(deviceId)) {
      const conn = connections.get(deviceId);
      if (conn.ws.readyState === WebSocket.OPEN) return conn;
      // Dead connection, clean up
      connections.delete(deviceId);
    }

    const conn = {
      ws: null,
      pending: new Map(), // requestId -> { resolve, reject, timer }
      ready: false,
    };

    const ws = new WebSocket(signalingUrl);
    conn.ws = ws;

    ws.on("open", () => {
      // 加入设备所在的房间，作为 initiator 角色
      ws.send(JSON.stringify({ type: "join", room: deviceId }));
      conn.ready = true;
      console.log(`[ws-exec] connected to room ${deviceId}`);
    });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      // 收到设备通过 signaling 转发的 result
      if (msg.type === "result") {
        handlePayload(conn, msg, deviceId);
      }
    });

    ws.on("close", () => {
      console.log(`[ws-exec] connection to ${deviceId} closed, will reconnect on next command`);
      // Reject all pending
      for (const [, req] of conn.pending) {
        clearTimeout(req.timer);
        req.reject(new Error(`WS connection closed for ${deviceId}`));
      }
      conn.pending.clear();
      connections.delete(deviceId);
    });

    ws.on("error", (err) => {
      console.warn(`[ws-exec] ws error for ${deviceId}:`, err.message);
    });

    connections.set(deviceId, conn);
    return conn;
  }

  function handlePayload(conn, payload, deviceId) {
    if (payload?.type !== "result" || !payload.requestId) return;
    const req = conn.pending.get(payload.requestId);
    if (!req) return;
    conn.pending.delete(payload.requestId);
    clearTimeout(req.timer);
    req.resolve({
      ...payload,
      deviceId: payload.deviceId ?? deviceId,
      action: req.action,
      transport: "ws-signaling",
      source: "ws-executor",
    });
  }

  function sendCommand(conn, deviceId, command, timeout) {
    return new Promise((resolve, reject) => {
      // 等 ws 连接就绪
      const waitAndSend = () => {
        const requestId = randomUUID();
        const timer = setTimeout(() => {
          conn.pending.delete(requestId);
          reject(new Error(`WS command timed out for ${deviceId}`));
        }, timeout);

        conn.pending.set(requestId, { resolve, reject, timer, action: command.action });

        // 通过 signaling 发送命令到同房间的设备
        // signaling 会把 {type:"command"} 转发给同房间其他人
        const msg = { type: "command", requestId, command };
        conn.ws.send(JSON.stringify(msg));
      };

      if (conn.ws.readyState === WebSocket.OPEN && conn.ready) {
        waitAndSend();
      } else {
        // 等连接建立
        const checkInterval = setInterval(() => {
          if (conn.ws.readyState === WebSocket.OPEN && conn.ready) {
            clearInterval(checkInterval);
            clearTimeout(connectTimeout);
            waitAndSend();
          }
        }, 50);
        const connectTimeout = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`WS connect timeout for ${deviceId}`));
        }, timeout);
      }
    });
  }
}
