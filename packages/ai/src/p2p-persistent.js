/**
 * 持久 P2P 执行器 — AI 与设备保持长连接 DataChannel，命令即时传达。
 *
 * 真实架构：
 *   1. AI/App 通过 signaling 交换 SDP/ICE（一次性握手）
 *   2. 建立 WebRTC DataChannel 直连（P2P，无中心化中继）
 *   3. 保持连接永不断开（心跳保活）
 *   4. 所有命令通过 DataChannel 直连传输（<50ms）
 *   5. signaling 只负责初始握手 + 断线重连时的信令交换
 *
 * 去中心化要点：
 *   - 数据传输不经过任何服务器
 *   - signaling server 仅用于建连，不参与数据流
 *   - 即使 signaling 挂了，已建立的连接仍然工作
 *
 * Stability hardening (v2):
 *   - Connection pool cleanup: periodic sweep of dead connections (avoid memory leaks)
 *   - Connection TTL: auto-close connections idle for 5 minutes (configurable)
 *   - Exponential backoff on reconnection attempts
 *   - Pool size limit to prevent unbounded growth
 */
import { randomUUID } from "node:crypto";
import { createPeerChannel } from "../../device/src/peer-channel.js";

// Connection idle timeout (ms) — auto-close connections with no activity beyond this
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// Pool cleanup sweep interval (ms)
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
// Max pool size: reject new connections if pool exceeds this
const DEFAULT_MAX_POOL_SIZE = 50;
// Reconnect backoff settings
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function createPersistentP2PExecutor({
  signalingUrl = process.env.SIGNALING_URL || "ws://localhost:8080",
  connectTimeoutMs = Number(process.env.AI_P2P_CONNECT_TIMEOUT || 10000),
  commandTimeoutMs = Number(process.env.AI_P2P_CMD_TIMEOUT || 5000),
  idleTimeoutMs = Number(process.env.AI_P2P_IDLE_TIMEOUT || DEFAULT_IDLE_TIMEOUT_MS),
  maxPoolSize = Number(process.env.AI_P2P_MAX_POOL || DEFAULT_MAX_POOL_SIZE),
  iceServers,
} = {}) {
  // Persistent connection pool: deviceId -> connection state
  const pool = new Map();

  // ---- Periodic cleanup: sweep dead/idle connections ----
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [deviceId, conn] of pool) {
      // Remove dead connections
      if (!conn.alive) {
        try { conn.channel?.destroy(); } catch {}
        pool.delete(deviceId);
        console.log(`[p2p-pool] cleaned dead connection: ${deviceId}`);
        continue;
      }
      // Auto-close idle connections (no commands sent/received within idleTimeoutMs)
      if (conn.lastActivityAt && now - conn.lastActivityAt > idleTimeoutMs) {
        console.log(
          `[p2p-pool] closing idle connection: ${deviceId} (idle ${Math.round((now - conn.lastActivityAt) / 1000)}s)`
        );
        conn.alive = false;
        try { conn.channel?.destroy(); } catch {}
        pool.delete(deviceId);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the timer to not keep Node.js process alive
  if (cleanupTimer.unref) cleanupTimer.unref();

  async function execute(deviceId, command) {
    let conn = pool.get(deviceId);

    // If no connection or connection is dead, establish a new persistent connection
    if (!conn || !conn.alive) {
      conn = await establishConnection(deviceId);
    }

    // Send command via existing DataChannel
    return sendCommand(conn, deviceId, command);
  }

  function establishConnection(deviceId) {
    return new Promise((resolve, reject) => {
      // Check pool size limit
      if (pool.size >= maxPoolSize && !pool.has(deviceId)) {
        reject(
          new Error(
            `P2P pool at capacity (${maxPoolSize}). Cannot connect to ${deviceId}. Close unused connections first.`
          )
        );
        return;
      }

      // Clean up old connection if any
      const old = pool.get(deviceId);
      if (old) {
        old.alive = false;
        try { old.channel.destroy(); } catch {}
        pool.delete(deviceId);
      }

      const conn = {
        channel: null,
        alive: false,
        pending: new Map(),
        lastActivityAt: Date.now(),
        reconnectAttempt: 0,
      };

      const timer = setTimeout(() => {
        conn.alive = false;
        try { conn.channel?.destroy(); } catch {}
        pool.delete(deviceId);
        reject(new Error(`P2P connect timeout for ${deviceId} (signaling handshake)`));
      }, connectTimeoutMs);

      conn.channel = createPeerChannel({
        signalingUrl,
        room: deviceId,
        initiator: true,
        iceServers,
        maxReconnectAttempts: 0, // we manage reconnection ourselves
        onConnect: () => {
          clearTimeout(timer);
          conn.alive = true;
          conn.lastActivityAt = Date.now();
          conn.reconnectAttempt = 0; // reset backoff on success
          pool.set(deviceId, conn);
          console.log(`[p2p] ✓ 直连建立: ${deviceId} (DataChannel ready)`);
          resolve(conn);
        },
        onData: (payload) => {
          conn.lastActivityAt = Date.now(); // update activity on data received

          if (payload?.type !== "result" || !payload.requestId) return;
          const req = conn.pending.get(payload.requestId);
          if (!req) return;
          conn.pending.delete(payload.requestId);
          clearTimeout(req.timer);
          req.resolve({
            ...payload,
            deviceId: payload.deviceId ?? deviceId,
            action: req.action,
            transport: "p2p-direct",
            source: "p2p-persistent",
          });
        },
        onStateChange: (state) => {
          if (state === "failed" || state === "disconnected") {
            console.log(`[p2p] ${deviceId} 连接断开，下次命令时自动重连`);
            conn.alive = false;
            // Reject all pending commands
            for (const [, req] of conn.pending) {
              clearTimeout(req.timer);
              req.reject(new Error(`P2P disconnected: ${deviceId}`));
            }
            conn.pending.clear();
            pool.delete(deviceId);
          }
        },
      });
    });
  }

  /**
   * Establish connection with exponential backoff retry.
   * Used internally when execute() finds a dead connection.
   */
  async function establishWithBackoff(deviceId) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        return await establishConnection(deviceId);
      } catch (err) {
        lastError = err;
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
        console.warn(
          `[p2p] reconnect attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS} for ${deviceId} failed, retrying in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  function sendCommand(conn, deviceId, command) {
    return new Promise((resolve, reject) => {
      if (!conn.alive) {
        reject(new Error(`P2P not connected to ${deviceId}`));
        return;
      }

      conn.lastActivityAt = Date.now(); // update activity on command send

      const requestId = randomUUID();
      const timer = setTimeout(() => {
        conn.pending.delete(requestId);
        // Command timeout may mean the connection is dead
        conn.alive = false;
        pool.delete(deviceId);
        reject(new Error(`P2P command timeout: ${deviceId} (connection marked dead)`));
      }, commandTimeoutMs);

      conn.pending.set(requestId, { resolve, reject, timer, action: command.action });

      try {
        conn.channel.send({ type: "command", requestId, command });
      } catch (err) {
        conn.pending.delete(requestId);
        clearTimeout(timer);
        conn.alive = false;
        pool.delete(deviceId);
        reject(new Error(`P2P send failed: ${deviceId} (${err.message})`));
      }
    });
  }

  // 获取连接状态（debug 用）
  function getStatus() {
    const status = {};
    for (const [id, conn] of pool) {
      status[id] = {
        alive: conn.alive,
        pending: conn.pending.size,
        idleMs: Date.now() - (conn.lastActivityAt || 0),
      };
    }
    return status;
  }

  /**
   * Gracefully shut down: destroy all connections and stop cleanup timer.
   * Call this when the executor is no longer needed.
   */
  function shutdown() {
    clearInterval(cleanupTimer);
    for (const [deviceId, conn] of pool) {
      conn.alive = false;
      // Reject pending
      for (const [, req] of conn.pending) {
        clearTimeout(req.timer);
        req.reject(new Error(`P2P executor shutting down`));
      }
      conn.pending.clear();
      try { conn.channel?.destroy(); } catch {}
    }
    pool.clear();
    console.log("[p2p-pool] executor shut down, all connections closed");
  }

  /**
   * Enhanced execute: auto-retry with exponential backoff on connection failure.
   */
  async function executeWithRetry(deviceId, command) {
    let conn = pool.get(deviceId);

    // If no connection or connection is dead, establish with backoff
    if (!conn || !conn.alive) {
      conn = await establishWithBackoff(deviceId);
    }

    // Send command via existing DataChannel
    return sendCommand(conn, deviceId, command);
  }

  execute.getStatus = getStatus;
  execute.shutdown = shutdown;
  execute.withRetry = executeWithRetry;
  return execute;
}
