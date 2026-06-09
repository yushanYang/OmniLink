/**
 * 通用虚拟设备模拟器 — 支持门锁、灯、空调、音箱等。
 * 通过环境变量指定设备类型和 ID，复用同一套 P2P 通信框架。
 *
 * 用法:
 *   DEVICE_ID=lamp-demo-002 DEVICE_TYPE=light node src/virtual-device.js
 *   DEVICE_ID=ac-room-003 DEVICE_TYPE=ac node src/virtual-device.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createPeerChannel } from "./peer-channel.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEVICE_ID = process.env.DEVICE_ID || "virtual-device-001";
const DEVICE_TYPE = (process.env.DEVICE_TYPE || "lock").toLowerCase();
const SIGNALING_URL = process.env.SIGNALING_URL || "ws://localhost:8080";

// 设备类型配置
const DEVICE_CONFIGS = {
  lock: {
    name: "Smart Lock",
    icon: "🔒",
    state: { locked: true },
    handle(state, action, value) {
      if (action === "lock") { state.locked = true; return { ok: true, state: { ...state } }; }
      if (action === "unlock") { state.locked = false; return { ok: true, state: { ...state } }; }
      if (action === "status") { return { ok: true, state: { ...state } }; }
      return { ok: false, error: `unknown action: ${action}` };
    },
    log(action, state) {
      if (action === "lock") console.log("🔒 门锁已上锁");
      else if (action === "unlock") console.log("🔓 门锁已解锁");
      else console.log(`📊 状态: locked=${state.locked}`);
    }
  },
  light: {
    name: "Light",
    icon: "💡",
    state: { brightness: 0, on: false },
    handle(state, action, value) {
      if (action === "set_brightness") {
        state.brightness = Math.max(0, Math.min(100, Number(value ?? 100)));
        state.on = state.brightness > 0;
        return { ok: true, state: { ...state } };
      }
      if (action === "unlock" || action === "turn_on") { state.on = true; state.brightness = state.brightness || 100; return { ok: true, state: { ...state } }; }
      if (action === "lock" || action === "turn_off") { state.on = false; state.brightness = 0; return { ok: true, state: { ...state } }; }
      if (action === "status") { return { ok: true, state: { ...state } }; }
      return { ok: false, error: `unknown action: ${action}` };
    },
    log(action, state) {
      if (state.on) console.log(`💡 灯已开启 (亮度: ${state.brightness}%)`);
      else console.log("🌑 灯已关闭");
    }
  },
  ac: {
    name: "Air Conditioner",
    icon: "❄️",
    state: { temperature: 24, on: true, mode: "cool" },
    handle(state, action, value) {
      if (action === "set_temperature") { state.temperature = Number(value ?? 24); return { ok: true, state: { ...state } }; }
      if (action === "unlock" || action === "turn_on") { state.on = true; return { ok: true, state: { ...state } }; }
      if (action === "lock" || action === "turn_off") { state.on = false; return { ok: true, state: { ...state } }; }
      if (action === "status") { return { ok: true, state: { ...state } }; }
      return { ok: false, error: `unknown action: ${action}` };
    },
    log(action, state) {
      if (state.on) console.log(`❄️ 空调运行中 (${state.temperature}°C, ${state.mode})`);
      else console.log("⏻ 空调已关闭");
    }
  },
  speaker: {
    name: "Speaker",
    icon: "🔊",
    state: { playing: false, volume: 50 },
    handle(state, action, value) {
      if (action === "unlock" || action === "play") { state.playing = true; return { ok: true, state: { ...state } }; }
      if (action === "lock" || action === "pause" || action === "stop") { state.playing = false; return { ok: true, state: { ...state } }; }
      if (action === "set_volume" || action === "volume_up") { state.volume = Math.min(100, (state.volume || 50) + 10); return { ok: true, state: { ...state } }; }
      if (action === "volume_down") { state.volume = Math.max(0, (state.volume || 50) - 10); return { ok: true, state: { ...state } }; }
      if (action === "status") { return { ok: true, state: { ...state } }; }
      return { ok: false, error: `unknown action: ${action}` };
    },
    log(action, state) {
      if (state.playing) console.log(`🎵 播放中 (音量: ${state.volume}%)`);
      else console.log("🔇 已暂停");
    }
  },
};

const config = DEVICE_CONFIGS[DEVICE_TYPE] || DEVICE_CONFIGS.lock;
const state = { ...config.state };

console.log(`${config.icon} 虚拟设备启动: ${DEVICE_ID} (${config.name})`);
console.log(`   类型: ${DEVICE_TYPE}`);
console.log(`   signaling: ${SIGNALING_URL}`);

// Auto-reconnect loop: when a connection drops, immediately listen for the next one
let channel = null;

let listening = false;

function startListening() {
  if (channel) { try { channel.destroy(); } catch {} }
  listening = true;
  channel = createPeerChannel({
    signalingUrl: SIGNALING_URL,
    room: DEVICE_ID,
    initiator: false,
    maxReconnectAttempts: 0, // no internal reconnect, we handle it externally
    onConnect: () => {
      channel.send({ type: "hello", deviceId: DEVICE_ID, deviceType: DEVICE_TYPE, state });
      console.log(`[${DEVICE_ID}] ✓ P2P 已连接`);
    },
    onData: (payload) => {
      if (payload?.type !== "command") return;
      console.log(`[${DEVICE_ID}] 收到指令:`, payload.command);

      const { action, value } = payload.command || {};
      const result = config.handle(state, action, value);
      config.log(action, state);

      channel.send({
        type: "result",
        requestId: payload.requestId,
        deviceId: DEVICE_ID,
        action,
        ...result,
      });
    },
    onStateChange: (newState, info) => {
      if (newState === "failed" || newState === "disconnected") {
        if (listening) {
          listening = false;
          console.log(`[${DEVICE_ID}] 连接结束，立即重新监听`);
          setTimeout(startListening, 100);
        }
      }
    },
  });
}

startListening();
console.log(`📡 等待 P2P 连接 (room=${DEVICE_ID})，支持多次连接`);
