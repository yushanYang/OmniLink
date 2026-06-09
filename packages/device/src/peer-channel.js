/**
 * WebRTC P2P 通道封装（基于 simple-peer + ws signaling）。
 * 设备端与客户端共用这套握手逻辑：连到 signaling 服务器、加入房间、交换 signal。
 *
 * 韧性（D5 / R5）：signaling WebSocket 断开后，simple-peer 的 SDP/ICE 交换已绑定到该 socket，
 * 无法原地恢复，因此重连必须同时重建 ws 与 SimplePeer。内部用闭包持有可变的 ws/peer 以及
 * attempt/state/destroyed，通过 connect()/reconnect() 管理生命周期。connection-state 回调
 * （onStateChange）以及若干重连参数都是 **新增可选项**，省略时行为与旧版完全一致。
 *
 * Stability hardening (v2):
 *   - Exponential backoff on reconnect (capped at 30s)
 *   - ICE connection state change logging & callback
 *   - Comprehensive destroy() that cleans up ALL timers and resources
 *   - WebSocket reconnect on unexpected close (already present, now more robust)
 */
import WebSocket from "ws";
import SimplePeer from "simple-peer";
import wrtc from "@roamhq/wrtc";

/**
 * @param {object} opts
 * @param {string} opts.signalingUrl  ws://host:port
 * @param {string} opts.room          房间号（通常用设备 DID）
 * @param {boolean} opts.initiator    发起方为 true（一般是用户端）
 * @param {string[]} [opts.iceServers] STUN/TURN 列表
 * @param {(data: any) => void} opts.onData     收到对端数据回调
 * @param {() => void} [opts.onConnect]         连接建立回调
 * @param {(state: string, info?: any) => void} [opts.onStateChange] 连接状态变化回调（每次变化触发一次）
 * @param {(iceState: string) => void} [opts.onIceStateChange] ICE connection state change callback
 * @param {number} [opts.maxReconnectAttempts=5]  最大重连次数
 * @param {number} [opts.reconnectBaseMs=1000]    指数退避基数（毫秒）；第 N 次重连等待 min(base×2^(N-1), 30000)
 * @param {number} [opts.reconnectMaxMs=30000]    退避上限（毫秒）
 * @param {number} [opts.holePunchTimeoutMs=15000] 打洞超时（毫秒），超时后判定为 failed 并提示同局域网回退
 * @returns {{ send: (obj:any)=>void, destroy: ()=>void, peer: SimplePeer.Instance }}
 */
export function createPeerChannel({
  signalingUrl,
  room,
  initiator,
  iceServers,
  onData,
  onConnect,
  onStateChange,
  onIceStateChange,
  maxReconnectAttempts = 5,
  reconnectBaseMs = 1000,
  reconnectMaxMs = 30000,
  holePunchTimeoutMs = 15000,
}) {
  const stunUrl = process.env.STUN_URL || "stun:stun.l.google.com:19302";
  const skipStun = process.env.SKIP_STUN === "true" || process.env.STUN_URL === "none";
  const config = {
    iceServers: skipStun ? [] : iceServers
      ? iceServers.map((u) => ({ urls: u }))
      : [{ urls: stunUrl }],
  };

  // Mutable state held in closure
  let ws = null;
  let peer = null;
  let attempt = 0;
  let state = null; // null -> connecting -> connected -> reconnecting -> (connected|failed) / disconnected
  let destroyed = false;
  let holePunchTimer = null;
  let reconnectTimer = null;

  // ---- State machine: only fire callback once per actual transition ----
  function setState(next, info) {
    if (state === next) return; // duplicate: don't re-fire
    if (state === "failed" || state === "disconnected") return; // terminal: no further transitions
    state = next;
    onStateChange?.(next, info);
  }

  function clearHolePunchTimer() {
    if (holePunchTimer) {
      clearTimeout(holePunchTimer);
      holePunchTimer = null;
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  /**
   * Tear down current connection (called before reconnect):
   * Remove all listeners first to prevent stale 'close' events from
   * triggering another reconnect cycle, then destroy peer/ws.
   */
  function teardownConnection() {
    clearHolePunchTimer();
    const oldPeer = peer;
    const oldWs = ws;
    peer = null;
    ws = null;
    if (oldPeer) {
      try { oldPeer.removeAllListeners(); } catch {}
      try { oldPeer.destroy(); } catch {}
    }
    if (oldWs) {
      try { oldWs.removeAllListeners(); } catch {}
      try { oldWs.close(); } catch {}
    }
  }

  // ---- Establish one connection: new ws + SimplePeer, attach listeners, start hole-punch timer ----
  function connect() {
    if (destroyed) return;
    setState("connecting");

    const socket = new WebSocket(signalingUrl);
    const p = new SimplePeer({ initiator, trickle: true, wrtc, config });
    ws = socket;
    peer = p;

    // Hole-punch timeout: if not connected within deadline -> failed
    // with hint to use Same-LAN fallback (R5.5 / R6.5)
    clearHolePunchTimer();
    holePunchTimer = setTimeout(() => {
      holePunchTimer = null;
      setState("failed", {
        reason: "hole-punch-timeout",
        message:
          "打洞超时（hole punching failed）：跨网络直连失败，请改用同一局域网（Same-LAN）直连回退。",
      });
    }, holePunchTimeoutMs);

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "join", room }));
    });

    socket.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "signal") {
        // Guard: ignore late signals after peer is destroyed (e.g. initiator disconnected)
        if (!p.destroyed) {
          try { p.signal(msg.data); } catch (err) {
            // Ignore "wrong state" errors from stale signals after reconnect
            if (!err.message?.includes('location')) console.warn("[p2p] signal ignored:", err.message);
          }
        }
      }
    });

    // ws closed and not intentionally destroyed -> enter reconnecting and schedule retry (R5.1)
    socket.on("close", () => {
      if (socket !== ws) return; // stale event from old connection, ignore
      if (destroyed || state === "failed" || state === "disconnected") return;
      console.log(`[p2p] signaling ws closed unexpectedly (room=${room}), scheduling reconnect`);
      setState("reconnecting");
      scheduleReconnect();
    });

    // Must handle 'error' to prevent EventEmitter throwing; reconnect is driven by 'close'
    socket.on("error", (err) => {
      console.warn("[p2p] signaling ws error:", err?.message ?? err);
    });

    p.on("signal", (data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "signal", room, data }));
      } else {
        socket.once("open", () =>
          socket.send(JSON.stringify({ type: "signal", room, data }))
        );
      }
    });

    p.on("connect", () => {
      clearHolePunchTimer();
      attempt = 0; // reset reconnect counter on successful connection
      console.log(`[p2p] connected (room=${room})`);
      setState("connected");
      onConnect?.();
    });

    p.on("data", (chunk) => {
      let payload;
      try {
        payload = JSON.parse(chunk.toString());
      } catch {
        payload = chunk.toString();
      }
      onData?.(payload);
    });

    p.on("error", (err) => console.error("[p2p] error:", err.message));

    // ---- ICE connection state monitoring ----
    // simple-peer exposes the underlying RTCPeerConnection via peer._pc
    // We watch iceConnectionState changes for diagnostics
    if (p._pc) {
      _attachIceMonitor(p._pc);
    } else {
      // _pc may not be available immediately; wait for it to be created
      const origSetup = p._setupData?.bind(p);
      const checkPc = setInterval(() => {
        if (p._pc) {
          clearInterval(checkPc);
          _attachIceMonitor(p._pc);
        }
        if (p.destroyed) clearInterval(checkPc);
      }, 50);
      // Safety: stop checking after 10s regardless
      setTimeout(() => clearInterval(checkPc), 10000);
    }

    function _attachIceMonitor(pc) {
      try {
        pc.addEventListener("iceconnectionstatechange", () => {
          const iceState = pc.iceConnectionState;
          console.log(`[p2p] ICE state: ${iceState} (room=${room})`);
          onIceStateChange?.(iceState);
        });
      } catch {}
    }
  }

  // ---- Schedule next reconnect: exponential backoff delay = base×2^(attempt-1), capped at reconnectMaxMs ----
  function scheduleReconnect() {
    if (destroyed || state === "failed" || state === "disconnected") return;
    if (attempt >= maxReconnectAttempts) {
      clearHolePunchTimer();
      setState("failed", {
        reason: "attempts-exhausted",
        message: `重连尝试已用尽（reconnection attempts exhausted，共 ${maxReconnectAttempts} 次）。`,
      });
      return;
    }
    attempt += 1;
    // Exponential backoff: base × 2^(attempt-1), capped
    const delay = Math.min(reconnectBaseMs * Math.pow(2, attempt - 1), reconnectMaxMs);
    console.log(`[p2p] reconnect attempt ${attempt}/${maxReconnectAttempts} in ${delay}ms (room=${room})`);
    clearReconnectTimer();
    reconnectTimer = setTimeout(reconnect, delay);
  }

  // ---- Execute reconnect: tear down old ws/peer, re-connect() (will re-join room and rebuild DataChannel) ----
  function reconnect() {
    reconnectTimer = null;
    if (destroyed) return;
    teardownConnection();
    connect();
  }

  // Initial connection
  connect();

  return {
    send: (obj) => {
      if (peer && peer.connected) peer.send(JSON.stringify(obj));
    },
    destroy: () => {
      if (destroyed) return; // idempotent
      destroyed = true; // suppress all subsequent reconnects
      clearHolePunchTimer();
      clearReconnectTimer();
      setState("disconnected");

      // Clean up peer
      if (peer) {
        try { peer.removeAllListeners(); } catch {}
        try { peer.destroy(); } catch {}
        peer = null;
      }
      // Clean up WebSocket
      if (ws) {
        try { ws.removeAllListeners(); } catch {}
        try { ws.close(); } catch {}
        ws = null;
      }
    },
    // Expose current peer via getter: after reconnect it still points to the latest instance
    get peer() {
      return peer;
    },
  };
}
