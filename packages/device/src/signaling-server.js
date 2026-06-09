/**
 * 简易 WebSocket signaling 服务器。
 *
 * ⚠️ 一周冲刺计划的"关键妥协"：第 1 周 signaling 先走最简单的 WebSocket 中转，
 *    先保证 P2P 能通。"把 signaling 搬上链"是第 2 周的去中心化升级。
 *
 * 职责：仅做 SDP / ICE 候选的房间内转发，不存储、不参与数据传输。
 * 用法: npm run signaling -w @omnilink/device
 *
 * 消息处理是「全函数」（total）：任何坏输入都被丢弃且不抛错、不断连，
 * 房间成员的增删都经由 joinRoom / leaveRoom，保证 churn 下零泄漏。
 *
 * Stability hardening (v2):
 *   - Heartbeat: 30s ping/pong, terminate unresponsive clients
 *   - Room capacity: max 10 peers per room (configurable via MAX_PEERS_PER_ROOM)
 *   - Global error handler: prevent uncaught exceptions from crashing the server
 *   - Disconnect cleanup: guaranteed removal from room on close/error
 *   - Room event logging: join/leave with timestamps
 */
import path from "node:path";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = Number(process.env.SIGNALING_PORT || 8080);

const ROOM_MIN_LEN = 1;
const ROOM_MAX_LEN = 128;

// Max peers allowed in a single room (prevent resource exhaustion)
const MAX_PEERS_PER_ROOM = Number(process.env.MAX_PEERS_PER_ROOM || 10);

// Heartbeat interval and timeout (ms)
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 35_000; // slightly longer than interval to allow for latency

// room -> Set<ws>
export const rooms = new Map();

/** room 必须是长度 1–128 的非空字符串 (R1.3, R1.10)。 */
function isValidRoom(room) {
  return (
    typeof room === "string" &&
    room.length >= ROOM_MIN_LEN &&
    room.length <= ROOM_MAX_LEN
  );
}

/**
 * 把连接加入房间，房间不存在则创建；记录房间号与加入后大小 (R1.3, R1.7)。
 * Set 去重，重复加入同一房间是幂等操作。
 * Returns false if room is at capacity (peer NOT added).
 */
export function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);

  // Room capacity check: reject if already at limit and peer not already in room
  if (peers.size >= MAX_PEERS_PER_ROOM && !peers.has(ws)) {
    console.warn(
      `[signaling] room "${room}" is full (max=${MAX_PEERS_PER_ROOM}), rejecting peer`
    );
    // Notify the client that the room is full
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "ROOM_FULL",
            message: `Room "${room}" has reached its capacity (${MAX_PEERS_PER_ROOM}).`,
          })
        );
      }
    } catch {}
    return false;
  }

  peers.add(ws);
  ws.room = room;
  console.log(
    `[signaling] peer joined room "${room}" (size=${peers.size}) [${new Date().toISOString()}]`
  );
  return true;
}

/**
 * 把连接移出当前房间；房间空了就从注册表删除；记录房间号与剩余大小
 * (R1.5, R1.6, R1.7)。无房间时安全返回。re-join 与 close 共用这一条清理路径，
 * 保证 churn 下零泄漏 (R1.8, R1.11)。
 */
export function leaveRoom(ws) {
  const room = ws.room;
  if (room == null) return;
  ws.room = null;

  const peers = rooms.get(room);
  if (!peers) return;

  peers.delete(ws);
  const size = peers.size;
  if (size === 0) rooms.delete(room);
  console.log(
    `[signaling] peer left room "${room}" (size=${size}) [${new Date().toISOString()}]`
  );
}

/**
 * 全函数式消息处理：解析并按 design 输入表分派；任何坏输入都丢弃，
 * 不抛错、不关闭连接。
 *
 * - 非 JSON 帧            → 丢弃，连接保持打开 (R1.1)
 * - 缺 type 或 type 非法  → 丢弃，继续处理后续消息 (R1.2, R3.2)
 * - join + 合法 room      → 加入房间（必要时先离开旧房间）(R1.3, R1.11)
 * - join + 非法 room      → 丢弃，不创建注册表项 (R1.10)
 * - signal 来自已入房连接 → 仅向同房其他人转发 {type, data} (R1.4, R3.3)
 * - signal 来自未入房连接 → 丢弃，不报错 (R1.9)
 */
export function handleMessage(ws, raw) {
  // Reset heartbeat activity timestamp on any incoming message
  ws._lastActivity = Date.now();

  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return; // R1.1：非 JSON，丢弃且保持连接
  }

  // R1.2 / R3.2：只接受对象且 type ∈ {join, signal}
  if (typeof msg !== "object" || msg === null) return;
  if (msg.type !== "join" && msg.type !== "signal" && msg.type !== "command" && msg.type !== "result") return;

  if (msg.type === "join") {
    if (!isValidRoom(msg.room)) return; // R1.10：非法 room，丢弃不建项
    // R1.11：已在其他房间则先离开旧房间（空则删除），再加入新房间
    if (ws.room != null && ws.room !== msg.room) {
      leaveRoom(ws);
    }
    joinRoom(ws, msg.room); // 幂等：重复加入同一房间安全
    return;
  }

  // msg.type === "signal"
  if (msg.type === "signal") {
    if (ws.room == null) return; // R1.9：未入房的 signal 丢弃
    const peers = rooms.get(ws.room);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        // R3.3：转发后只含 type 与 SDP/ICE 的 data，其余字段一律剔除
        peer.send(JSON.stringify({ type: "signal", data: msg.data }));
      }
    }
    return;
  }

  // command / result：直接转发给同房间其他人（用于 ws-executor 无 WebRTC 模式）
  if (msg.type === "command" || msg.type === "result") {
    if (ws.room == null) return;
    const peers = rooms.get(ws.room);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        peer.send(JSON.stringify(msg));
      }
    }
  }
}

/**
 * 启动 signaling 服务器并接线连接/消息/关闭处理。
 * 抽成函数便于测试时按需启动 / 关闭。
 *
 * Stability features:
 *   - Heartbeat ping/pong every 30s; terminates unresponsive clients
 *   - Global error handlers for uncaught exceptions/rejections
 *   - Per-connection error handler to prevent crash on socket errors
 */
export function startSignalingServer(port = PORT) {
  const wss = new WebSocketServer({ port });

  // ---- Global error handlers: prevent server crash ----
  process.on("uncaughtException", (err) => {
    console.error("[signaling] uncaughtException (server kept alive):", err?.message || err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[signaling] unhandledRejection (server kept alive):", reason);
  });

  wss.on("error", (err) => {
    console.error("[signaling] WebSocketServer error:", err?.message || err);
  });

  // ---- Heartbeat interval: ping all clients every 30s ----
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const ws of wss.clients) {
      // If the client hasn't responded within the timeout, terminate
      if (ws._lastActivity && now - ws._lastActivity > HEARTBEAT_TIMEOUT_MS) {
        console.warn("[signaling] heartbeat timeout, terminating client");
        leaveRoom(ws);
        ws.terminate();
        continue;
      }
      // Send ping; the 'pong' response will update _lastActivity
      try {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        }
      } catch {}
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Clean up interval when server closes
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", (ws) => {
    ws.room = null;
    ws._lastActivity = Date.now();

    // Pong response from client updates activity timestamp
    ws.on("pong", () => {
      ws._lastActivity = Date.now();
    });

    ws.on("message", (raw) => handleMessage(ws, raw));

    // R1.5/R1.6：移出房间，空则删除; also handle unexpected errors
    ws.on("close", () => leaveRoom(ws));
    ws.on("error", (err) => {
      console.warn("[signaling] client socket error:", err?.message || err);
      leaveRoom(ws);
    });
  });

  console.log(`🔀 OmniLink signaling server listening on ws://localhost:${port}`);
  return wss;
}

// 仅在作为脚本直接运行时启动（被测试 import 时不产生副作用）
if (import.meta.main) {
  startSignalingServer(PORT);
}
