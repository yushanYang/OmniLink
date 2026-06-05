/**
 * WebRTC P2P 通道封装（基于 simple-peer + ws signaling）。
 * 设备端与客户端共用这套握手逻辑：连到 signaling 服务器、加入房间、交换 signal。
 *
 * 韧性（D5 / R5）：signaling WebSocket 断开后，simple-peer 的 SDP/ICE 交换已绑定到该 socket，
 * 无法原地恢复，因此重连必须同时重建 ws 与 SimplePeer。内部用闭包持有可变的 ws/peer 以及
 * attempt/state/destroyed，通过 connect()/reconnect() 管理生命周期。connection-state 回调
 * （onStateChange）以及若干重连参数都是 **新增可选项**，省略时行为与旧版完全一致。
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
 * @param {number} [opts.maxReconnectAttempts=5]  最大重连次数
 * @param {number} [opts.reconnectBaseMs=1000]    线性退避基数（毫秒）；第 N 次重连等待 N×base
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
  maxReconnectAttempts = 5,
  reconnectBaseMs = 1000,
  holePunchTimeoutMs = 15000,
}) {
  const stunUrl = process.env.STUN_URL || "stun:stun.l.google.com:19302";
  const config = {
    iceServers: iceServers
      ? iceServers.map((u) => ({ urls: u }))
      : [{ urls: stunUrl }],
  };

  // 闭包持有的可变状态
  let ws = null;
  let peer = null;
  let attempt = 0;
  let state = null; // null -> connecting -> connected -> reconnecting -> (connected|failed) / disconnected
  let destroyed = false;
  let holePunchTimer = null;
  let reconnectTimer = null;

  // ---- 状态机：每次真正发生变化时只触发一次回调 ----
  function setState(next, info) {
    if (state === next) return; // 重复同态：不重复触发
    if (state === "failed" || state === "disconnected") return; // 终态：不再迁移
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

  // 拆掉当前连接（重连前调用）：先摘除监听避免旧 close 再次触发重连，再销毁 peer/ws
  function teardownConnection() {
    clearHolePunchTimer();
    const oldPeer = peer;
    const oldWs = ws;
    peer = null;
    ws = null;
    if (oldPeer) {
      try {
        oldPeer.removeAllListeners();
      } catch {}
      try {
        oldPeer.destroy();
      } catch {}
    }
    if (oldWs) {
      try {
        oldWs.removeAllListeners();
      } catch {}
      try {
        oldWs.close();
      } catch {}
    }
  }

  // ---- 建立一次连接：新建 ws + SimplePeer，挂监听，进入 connecting，并武装打洞计时器 ----
  function connect() {
    if (destroyed) return;
    setState("connecting");

    const socket = new WebSocket(signalingUrl);
    const p = new SimplePeer({ initiator, trickle: true, wrtc, config });
    ws = socket;
    peer = p;

    // 打洞超时：超时仍未连上 -> failed，并提示需要 Same-LAN 回退（R5.5 / R6.5）
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
        p.signal(msg.data);
      }
    });

    // ws 关闭且非主动 destroy -> 进入 reconnecting 并安排重连（R5.1）
    socket.on("close", () => {
      if (socket !== ws) return; // 旧连接的迟到事件，忽略
      if (destroyed || state === "failed" || state === "disconnected") return;
      setState("reconnecting");
      scheduleReconnect();
    });

    // 重连过程中连接失败的 ws 会触发 'error'，必须监听以免 EventEmitter 抛出导致进程崩溃；
    // 真正的重连由 'close' 驱动。
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
      attempt = 0; // 连上后重置重连计数
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
  }

  // ---- 安排下一次重连：线性退避 delay = attempt × base；超出上限 -> failed ----
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
    const delay = attempt * reconnectBaseMs;
    clearReconnectTimer();
    reconnectTimer = setTimeout(reconnect, delay);
  }

  // ---- 执行重连：拆掉旧 ws/peer，重新 connect()（会重新 join 房间并重建 DataChannel）----
  function reconnect() {
    reconnectTimer = null;
    if (destroyed) return;
    teardownConnection();
    connect();
  }

  // 首次连接
  connect();

  return {
    send: (obj) => {
      if (peer && peer.connected) peer.send(JSON.stringify(obj));
    },
    destroy: () => {
      destroyed = true; // 抑制后续重连
      clearHolePunchTimer();
      clearReconnectTimer();
      setState("disconnected");
      if (peer) {
        try {
          peer.destroy();
        } catch {}
      }
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    },
    // 暴露当前 peer：用 getter 保证重连后仍指向最新实例（保持 { send, destroy, peer } 契约）
    get peer() {
      return peer;
    },
  };
}
