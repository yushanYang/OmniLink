import { randomUUID } from "node:crypto";
import { createPeerChannel } from "../../device/src/peer-channel.js";

/**
 * Creates a pooled P2P executor that reuses WebRTC connections.
 * First command to a device pays the full handshake cost (~3-5s),
 * subsequent commands reuse the existing DataChannel (~10ms).
 */
export function createP2PExecutor({
  signalingUrl = process.env.SIGNALING_URL || "ws://localhost:8080",
  timeoutMs = Number(process.env.AI_P2P_TIMEOUT_MS || 12000),
  iceServers,
  idleTimeoutMs = Number(process.env.AI_P2P_IDLE_MS || 60000), // close idle connections after 60s
} = {}) {
  // Connection pool: deviceId -> { channel, connected, pending, idleTimer }
  const pool = new Map();

  return async function executeOverP2P(deviceId, command) {
    const conn = getOrCreateConnection(deviceId);

    // Wait for connection to be ready
    if (!conn.connected) {
      await waitForConnect(conn, timeoutMs);
    }

    return sendCommand(conn, deviceId, command, timeoutMs);
  };

  function getOrCreateConnection(deviceId) {
    if (pool.has(deviceId)) {
      const conn = pool.get(deviceId);
      // Reset idle timer on reuse
      resetIdleTimer(conn, deviceId);
      return conn;
    }

    const conn = {
      channel: null,
      connected: false,
      connectPromise: null,
      connectResolve: null,
      connectReject: null,
      pending: new Map(), // requestId -> { resolve, reject, timer }
      idleTimer: null,
    };

    // Create connect promise
    conn.connectPromise = new Promise((resolve, reject) => {
      conn.connectResolve = resolve;
      conn.connectReject = reject;
    });

    conn.channel = createPeerChannel({
      signalingUrl,
      room: deviceId,
      initiator: true,
      iceServers,
      onConnect: () => {
        conn.connected = true;
        conn.connectResolve?.();
        console.log(`[p2p-pool] connected to ${deviceId}`);
        resetIdleTimer(conn, deviceId);
      },
      onData: (payload) => {
        if (payload?.type !== "result" || !payload.requestId) return;
        const req = conn.pending.get(payload.requestId);
        if (!req) return;
        conn.pending.delete(payload.requestId);
        clearTimeout(req.timer);
        req.resolve({
          ...payload,
          deviceId: payload.deviceId ?? deviceId,
          action: req.action,
          requestId: payload.requestId,
          transport: "p2p",
          source: "p2p-executor",
        });
        resetIdleTimer(conn, deviceId);
      },
      onStateChange: (state, info) => {
        if (state === "failed" || state === "disconnected") {
          console.warn(`[p2p-pool] ${deviceId} connection ${state}`, info?.message || "");
          // Reject all pending requests
          for (const [reqId, req] of conn.pending) {
            clearTimeout(req.timer);
            req.reject(new Error(`P2P connection ${state} for ${deviceId}`));
          }
          conn.pending.clear();
          conn.connected = false;
          conn.connectReject?.(new Error(`P2P connection ${state}`));
          pool.delete(deviceId);
        }
      },
    });

    pool.set(deviceId, conn);
    return conn;
  }

  async function waitForConnect(conn, timeout) {
    const timer = setTimeout(() => {
      conn.connectReject?.(new Error("P2P connect timeout"));
    }, timeout);

    try {
      await conn.connectPromise;
    } finally {
      clearTimeout(timer);
    }
  }

  function sendCommand(conn, deviceId, command, timeout) {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();

      const timer = setTimeout(() => {
        conn.pending.delete(requestId);
        reject(new Error(`P2P command timed out for ${deviceId}`));
      }, timeout);

      conn.pending.set(requestId, { resolve, reject, timer, action: command.action });
      conn.channel.send({ type: "command", requestId, command });
    });
  }

  function resetIdleTimer(conn, deviceId) {
    if (conn.idleTimer) clearTimeout(conn.idleTimer);
    conn.idleTimer = setTimeout(() => {
      console.log(`[p2p-pool] closing idle connection to ${deviceId}`);
      conn.channel?.destroy();
      pool.delete(deviceId);
    }, idleTimeoutMs);
  }
}

/**
 * One-shot executor (no pooling) — kept for backward compatibility / testing.
 */
export function sendCommandOverP2P({ signalingUrl, timeoutMs = 12000, iceServers, deviceId, command }) {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    let channel;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel?.destroy();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error(`P2P command timed out for ${deviceId}`));
    }, timeoutMs);

    channel = createPeerChannel({
      signalingUrl,
      room: deviceId,
      initiator: true,
      iceServers,
      onConnect: () => {
        channel.send({ type: "command", requestId, command });
      },
      onData: (payload) => {
        if (payload?.type !== "result" || payload.requestId !== requestId) return;
        finish(resolve, {
          ...payload,
          deviceId: payload.deviceId ?? deviceId,
          action: command.action,
          requestId,
          transport: "p2p",
          source: "p2p-executor",
        });
      },
    });
  });
}
