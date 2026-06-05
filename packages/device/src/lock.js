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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createPeerChannel } from "./peer-channel.js";

// TronWeb dynamic import (ESM)
const TronWeb = (await import("tronweb")).default;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEVICE_ID = process.env.DEVICE_ID || "omnilink-lock-001";
const SIGNALING_URL = process.env.SIGNALING_URL || "ws://localhost:8080";

/**
 * 链上配置（从 .env 读取）
 */
const TRON_FULL_NODE = process.env.TRON_FULL_NODE || "https://nile.trongrid.io";
const TRON_PRIVATE_KEY = process.env.TRON_PRIVATE_KEY || "";
const DEVICE_REGISTRY_ADDRESS = process.env.DEVICE_REGISTRY_ADDRESS || "";
// ABI 路径：相对于 monorepo 根目录
const ABI_PATH = path.resolve(process.cwd(), "../contracts/build/DeviceRegistry.json");

/**
 * 创建门锁初始状态。
 * @param {string} [deviceId]
 * @returns {{ deviceId: string, type: "smart-lock", locked: boolean, lastChangedAt: number }}
 */
export function createInitialState(deviceId = DEVICE_ID) {
  return {
    deviceId,
    type: "smart-lock",
    locked: true,
    lastChangedAt: Date.now(),
  };
}

/**
 * 纯函数：对门锁状态应用单条指令，返回新状态与结果（不含 requestId/type）。
 * 不修改传入的 state，便于单元/属性测试（无需 WebRTC）。
 *
 *   - lock/unlock : 设置 locked 并更新 lastChangedAt（保证 >= 旧值），ok:true 返回新状态
 *   - status      : 不修改状态，ok:true 返回当前状态
 *   - 缺失/空/未知 action : ok:false 返回 error，state 与 lastChangedAt 保持不变
 *
 * @param {object} state              当前门锁状态 { deviceId, type, locked, lastChangedAt }
 * @param {{ action?: string, value?: any }} [command] 指令体
 * @returns {{ state: object, result: { ok: boolean, state?: object, error?: string } }}
 */
export function applyCommand(state, command) {
  const action = command?.action;
  switch (action) {
    case "lock":
    case "unlock": {
      const nextState = {
        ...state,
        locked: action === "lock",
        // 保证 lastChangedAt 单调不减：即便系统时钟回拨也不会小于上一次
        lastChangedAt: Math.max(Date.now(), state?.lastChangedAt ?? 0),
      };
      return { state: nextState, result: { ok: true, state: nextState } };
    }
    case "status":
      // 查询不改变状态
      return { state, result: { ok: true, state } };
    default:
      return {
        state,
        result: { ok: false, error: `unknown action: ${String(action)}` },
      };
  }
}

/**
 * 纯函数：处理一条 command 消息，返回新状态与完整的 result 消息。
 * requestId 原样回传（包括缺失时为 undefined），满足 Property 8（requestId 往返一致）。
 *
 * @param {object} state 当前门锁状态
 * @param {{ type?: string, requestId?: any, command?: { action?: string, value?: any } }} msg
 * @returns {{ state: object, result: { type: "result", requestId: any, ok: boolean, state?: object, error?: string } }}
 */
export function handleCommand(state, msg) {
  const { state: nextState, result } = applyCommand(state, msg?.command);
  return {
    state: nextState,
    // requestId 原样回传（缺失时为 undefined）
    result: { type: "result", requestId: msg?.requestId, ...result },
  };
}

async function main() {
  // ===== 链上注册 =====
  if (!TRON_PRIVATE_KEY || !DEVICE_REGISTRY_ADDRESS) {
    console.warn("⚠️  TRON_PRIVATE_KEY 或 DEVICE_REGISTRY_ADDRESS 未配置，跳过上链注册（本地模式）");
  } else {
    console.log("⛓️  正在上链注册设备...");
    try {
      const tronWeb = new TronWeb({
        fullHost: TRON_FULL_NODE,
        privateKey: TRON_PRIVATE_KEY,
      });

      // 加载 ABI
      const abi = JSON.parse(readFileSync(ABI_PATH, "utf-8"));
      const contract = tronWeb.contract(abi, DEVICE_REGISTRY_ADDRESS);

      // 生成设备公钥（ed25519）
      const { publicKey } = crypto.generateKeyPairSync("ed25519");
      const pubkeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");

      // connInfo = signaling room (即 DEVICE_ID)
      const connInfo = DEVICE_ID;

      // 调用 registerDevice(deviceId, pubkey, connInfo)
      const tx = await contract.registerDevice(DEVICE_ID, "0x" + pubkeyHex, connInfo).send({
        feeLimit: 100_000_000, // 100 TRX fee limit
        shouldPollResponse: true,
      });

      console.log(`✅ 上链注册成功！txID: ${tx}`);
      console.log(`   deviceId: ${DEVICE_ID}`);
      console.log(`   pubkey: ${pubkeyHex.slice(0, 32)}...`);
      console.log(`   connInfo: ${connInfo}`);
    } catch (err) {
      // 已注册的设备会 revert "device already registered"，属正常情况
      if (err?.message?.includes("already registered")) {
        console.log(`ℹ️  设备 ${DEVICE_ID} 已在链上注册，跳过`);
      } else {
        console.error("❌ 上链注册失败:", err?.message || err);
        console.log("   继续以本地模式运行...");
      }
    }
  }

  // ===== 门锁运行时 =====
  const state = createInitialState();
  console.log(`🔧 虚拟门锁启动: ${DEVICE_ID}`);

  // 门锁作为被连接方（非 initiator），房间号用设备 DID
  const channel = createPeerChannel({
    signalingUrl: SIGNALING_URL,
    room: DEVICE_ID,
    initiator: false,
    onConnect: () => channel.send({ type: "hello", state }),
    onData: (payload) => {
      console.log("[lock] 收到指令:", payload);
      if (payload?.type !== "command") return;

      const { state: nextState, result } = handleCommand(state, payload);
      // 把纯函数算出的新状态合并回可变的本地状态
      Object.assign(state, nextState);

      const action = payload?.command?.action;
      if (result.ok && action === "lock") console.log("🔒 门锁已上锁");
      else if (result.ok && action === "unlock") console.log("🔓 门锁已解锁");

      channel.send(result);
    },
  });

  console.log(`📡 门锁已就绪，等待 P2P 连接 (room=${DEVICE_ID})`);
}

// 仅当作为入口脚本直接运行时才启动 P2P 连接；被测试 import 时不产生副作用。
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
