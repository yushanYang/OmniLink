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
 */
import path from "node:path";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = Number(process.env.SIGNALING_PORT || 8080);

const ROOM_MIN_LEN = 1;
const ROOM_MAX_LEN = 128;

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
 */
export function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);
  peers.add(ws);
  ws.room = room;
  console.log(`[signaling] peer joined room "${room}" (size=${peers.size})`);
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
  console.log(`[signaling] peer left room "${room}" (size=${size})`);
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
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return; // R1.1：非 JSON，丢弃且保持连接
  }

  // R1.2 / R3.2：只接受对象且 type ∈ {join, signal}
  if (typeof msg !== "object" || msg === null) return;
  if (msg.type !== "join" && msg.type !== "signal") return;

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
  if (ws.room == null) return; // R1.9：未入房的 signal 丢弃
  const peers = rooms.get(ws.room);
  if (!peers) return;
  for (const peer of peers) {
    if (peer !== ws && peer.readyState === peer.OPEN) {
      // R3.3：转发后只含 type 与 SDP/ICE 的 data，其余字段一律剔除
      peer.send(JSON.stringify({ type: "signal", data: msg.data }));
    }
  }
}

/**
 * 启动 signaling 服务器并接线连接/消息/关闭处理。
 * 抽成函数便于测试时按需启动 / 关闭。
 */
export function startSignalingServer(port = PORT) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    ws.room = null;
    ws.on("message", (raw) => handleMessage(ws, raw));
    ws.on("close", () => leaveRoom(ws)); // R1.5/R1.6：移出房间，空则删除
  });

  console.log(`🔀 OmniLink signaling server listening on ws://localhost:${port}`);
  return wss;
}

// 仅在作为脚本直接运行时启动（被测试 import 时不产生副作用）
if (import.meta.main) {
  startSignalingServer(PORT);
}
