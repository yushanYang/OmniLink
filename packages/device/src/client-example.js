/**
 * 客户端连接示例（发起方 / initiator）。
 *
 * 复用 createPeerChannel 这套握手逻辑，演示前端 / AI 执行器如何连接门锁：
 *   1. 以 initiator=true 连到 signaling 服务器，房间号 = 设备 DID(DEVICE_ID)
 *   2. 连接建立后，向门锁发送「恰好一条」command
 *   3. 通过 onData 收到门锁回传的 result 并打印
 *   4. 收到结果后干净地 destroy()，关闭 P2P 与 signaling 连接
 *
 * 环境变量（除环境值外无需改动代码即可运行 — R7.5）：
 *   SIGNALING_URL  signaling 服务器地址，默认 ws://localhost:8080
 *   DEVICE_ID      目标门锁的 DID（房间号），默认 omnilink-lock-001
 *   COMMAND_ACTION 要发送的指令 lock|unlock|status，默认 status
 *
 * 用法: npm run client -w @omnilink/device
 */
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createPeerChannel } from "./peer-channel.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SIGNALING_URL = process.env.SIGNALING_URL || "ws://localhost:8080";
const DEVICE_ID = process.env.DEVICE_ID || "omnilink-lock-001";
const ACTION = process.env.COMMAND_ACTION || "status";

async function main() {
  console.log(`🔗 客户端示例启动 (initiator)`);
  console.log(`   signaling: ${SIGNALING_URL}`);
  console.log(`   room(DID): ${DEVICE_ID}`);

  // 用于关联 command 与 result（Property 8：requestId 原样回传）
  const requestId = crypto.randomUUID();
  let commandSent = false;
  let cleanedUp = false;

  // 收到结果或异常时统一清理，确保 destroy() 只执行一次
  const cleanup = (code) => {
    if (cleanedUp) return;
    cleanedUp = true;
    channel.destroy();
    process.exit(code);
  };

  // 门锁作为被连接方；客户端作为 initiator，房间号用设备 DID
  const channel = createPeerChannel({
    signalingUrl: SIGNALING_URL,
    room: DEVICE_ID,
    initiator: true,
    onConnect: () => {
      // 连接建立后只发送恰好一条 command（R4.5）
      if (commandSent) return;
      commandSent = true;
      const command = { type: "command", requestId, command: { action: ACTION } };
      console.log("[client] ▶ 发送指令:", command);
      channel.send(command);
    },
    onData: (payload) => {
      console.log("[client] ◀ 收到回执:", payload);
      // 收到与本次 command 对应的 result 后干净退出
      if (payload?.type === "result") {
        if (payload.requestId === requestId) {
          console.log(`✅ requestId 匹配，门锁回执 ok=${payload.ok}`);
        }
        cleanup(0);
      }
    },
  });

  // 兜底超时：15s 内未连通则退出（与 hole-punch 超时一致）
  setTimeout(() => {
    console.error("✗ 超时：15s 内未收到门锁回执");
    cleanup(1);
  }, 15000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
