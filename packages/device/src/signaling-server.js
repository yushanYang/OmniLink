/**
 * 简易 WebSocket signaling 服务器。
 *
 * ⚠️ 一周冲刺计划的"关键妥协"：第 1 周 signaling 先走最简单的 WebSocket 中转，
 *    先保证 P2P 能通。"把 signaling 搬上链"是第 2 周的去中心化升级。
 *
 * 职责：仅做 SDP / ICE 候选的房间内转发，不存储、不参与数据传输。
 * 用法: npm run signaling -w @omnilink/device
 */
import path from "node:path";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = Number(process.env.SIGNALING_PORT || 8080);

// room -> Set<ws>
const rooms = new Map();

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  ws.room = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // { type: "join", room }  加入房间
    if (msg.type === "join" && msg.room) {
      ws.room = msg.room;
      if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
      rooms.get(msg.room).add(ws);
      console.log(`[signaling] peer joined room "${msg.room}" (size=${rooms.get(msg.room).size})`);
      return;
    }

    // { type: "signal", room, data }  转发 WebRTC signal 给房间内其他人
    if (msg.type === "signal" && ws.room) {
      const peers = rooms.get(ws.room);
      if (!peers) return;
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === peer.OPEN) {
          peer.send(JSON.stringify({ type: "signal", data: msg.data }));
        }
      }
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms.has(ws.room)) {
      const peers = rooms.get(ws.room);
      peers.delete(ws);
      if (peers.size === 0) rooms.delete(ws.room);
      console.log(`[signaling] peer left room "${ws.room}"`);
    }
  });
});

console.log(`🔀 OmniLink signaling server listening on ws://localhost:${PORT}`);
