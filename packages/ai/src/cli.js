/**
 * AI 管家命令行 demo。
 * 用 mock executor 跑通"自然语言 → 指令"闭环，无需真实 P2P/链即可演示 AI 层。
 *
 * 用法: npm run ai   (需在 .env 配置 OPENAI_API_KEY)
 */
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";
import { createButler } from "./index.js";
import { DeviceRouter } from "./router.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ── Mock 设备层（联调前的占位）──
const mockDevices = [{ deviceId: "omnilink-lock-001", type: "smart-lock", locked: true }];

const router = new DeviceRouter({
  listDevices: async () => mockDevices.map((d) => ({ deviceId: d.deviceId, type: d.type })),
  executor: async (deviceId, command) => {
    const dev = mockDevices.find((d) => d.deviceId === deviceId);
    if (!dev) return { ok: false, error: "device not found" };
    if (command.action === "lock") dev.locked = true;
    if (command.action === "unlock") dev.locked = false;
    console.log(`  → [mock] ${deviceId}: ${command.action}`, command.value ?? "");
    return { ok: true, deviceId, locked: dev.locked };
  },
});

async function main() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
    console.error("✗ 请在 .env 设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const butler = createButler({ router });
  console.log("🧠 OmniLink AI 管家已就绪。试试: 把门锁上 / 解锁 / 我有哪些设备");
  console.log("   (输入 exit 退出)\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "你 > " });
  rl.prompt();

  rl.on("line", async (line) => {
    const text = line.trim();
    if (text === "exit" || text === "quit") return rl.close();
    if (text) {
      try {
        const reply = await butler.chat(text);
        console.log("管家 >", reply, "\n");
      } catch (err) {
        console.error("✗", err.message, "\n");
      }
    }
    rl.prompt();
  });

  rl.on("close", () => process.exit(0));
}

main();
