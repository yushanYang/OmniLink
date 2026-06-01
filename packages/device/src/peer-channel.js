/**
 * WebRTC P2P 通道封装（基于 simple-peer + ws signaling）。
 * 设备端与客户端共用这套握手逻辑：连到 signaling 服务器、加入房间、交换 signal。
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
 * @returns {{ send: (obj:any)=>void, destroy: ()=>void, peer: SimplePeer.Instance }}
 */
export function createPeerChannel({ signalingUrl, room, initiator, iceServers, onData, onConnect }) {
  const stunUrl = process.env.STUN_URL || "stun:stun.l.google.com:19302";
  const config = {
    iceServers: iceServers
      ? iceServers.map((u) => ({ urls: u }))
      : [{ urls: stunUrl }],
  };

  const ws = new WebSocket(signalingUrl);
  const peer = new SimplePeer({ initiator, trickle: true, wrtc, config });

  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "join", room }));
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "signal") {
      peer.signal(msg.data);
    }
  });

  peer.on("signal", (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "signal", room, data }));
    } else {
      ws.once("open", () => ws.send(JSON.stringify({ type: "signal", room, data })));
    }
  });

  peer.on("connect", () => {
    console.log(`[p2p] connected (room=${room})`);
    onConnect?.();
  });

  peer.on("data", (chunk) => {
    let payload;
    try {
      payload = JSON.parse(chunk.toString());
    } catch {
      payload = chunk.toString();
    }
    onData?.(payload);
  });

  peer.on("error", (err) => console.error("[p2p] error:", err.message));

  return {
    send: (obj) => peer.connected && peer.send(JSON.stringify(obj)),
    destroy: () => {
      peer.destroy();
      ws.close();
    },
    peer,
  };
}
