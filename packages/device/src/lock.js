/**
 * 虚拟智能门锁（演示主设备）。
 *
 * 生命周期（对应冲刺计划 Day 2-3）：
 *   1. 启动时在 TRON 链上自注册身份(DID)   —— 第 2 周接通真实合约前，先本地模拟
 *   2. 维持一个可被 P2P 连接的服务端（非 initiator）
 *   3. 收到 P2P 指令(lock/unlock/status)后改变状态并回传
 *
 * 用法: npm run device -w @omnilink/device
 */
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createPeerChannel } from "./peer-channel.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEVICE_ID = process.env.DEVICE_ID || "omnilink-lock-001";
const SIGNALING_URL = process.env.SIGNALING_URL || "ws://localhost:8080";

// 门锁状态
const state = {
  deviceId: DEVICE_ID,
  type: "smart-lock",
  locked: true,
  lastChangedAt: Date.now(),
};

function applyCommand(cmd) {
  switch (cmd.action) {
    case "lock":
      state.locked = true;
      state.lastChangedAt = Date.now();
      console.log("🔒 门锁已上锁");
      break;
    case "unlock":
      state.locked = false;
      state.lastChangedAt = Date.now();
      console.log("🔓 门锁已解锁");
      break;
    case "status":
      break;
    default:
      return { ok: false, error: `unknown action: ${cmd.action}` };
  }
  return { ok: true, state };
}

async function main() {
  // TODO(第2周): 调用 DeviceRegistry.registerDevice 真正上链。
  // MVP 先生成一对演示用公钥并打印，模拟"上链注册身份"。
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  const pubkeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

  console.log(`🔧 虚拟门锁启动: ${DEVICE_ID}`);
  console.log(`   pubkey(模拟DID): ${pubkeyHex.slice(0, 32)}...`);
  console.log(`   [TODO] 第2周接通 DeviceRegistry.registerDevice 真正上链`);

  // 门锁作为被连接方（非 initiator），房间号用设备 DID
  const channel = createPeerChannel({
    signalingUrl: SIGNALING_URL,
    room: DEVICE_ID,
    initiator: false,
    onConnect: () => channel.send({ type: "hello", state }),
    onData: (payload) => {
      console.log("[lock] 收到指令:", payload);
      if (payload?.type === "command") {
        const result = applyCommand(payload.command);
        channel.send({ type: "result", requestId: payload.requestId, ...result });
      }
    },
  });

  console.log(`📡 门锁已就绪，等待 P2P 连接 (room=${DEVICE_ID})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
