/**
 * 临时冒烟测试：两个 peer 经本地 signaling 互发一条消息，验证 P2P 通道可用。
 * 与冲刺计划 Day 1 的"最高风险验证"对应。运行: node src/p2p-smoke.js
 */
import { createPeerChannel } from "./peer-channel.js";

const SIGNALING_URL = "ws://localhost:8080";
const ROOM = "smoke-test-room";

let received = 0;
const done = () => {
  if (++received >= 2) {
    console.log("✅ P2P 双向消息互通成功");
    process.exit(0);
  }
};

const lock = createPeerChannel({
  signalingUrl: SIGNALING_URL,
  room: ROOM,
  initiator: false,
  onConnect: () => lock.send({ from: "lock", msg: "hello from lock" }),
  onData: (d) => {
    console.log("[lock] got:", d);
    done();
  },
});

setTimeout(() => {
  const user = createPeerChannel({
    signalingUrl: SIGNALING_URL,
    room: ROOM,
    initiator: true,
    onConnect: () => user.send({ from: "user", msg: "hello from user" }),
    onData: (d) => {
      console.log("[user] got:", d);
      done();
    },
  });
}, 500);

setTimeout(() => {
  console.error("✗ 超时：P2P 未在 15s 内连通");
  process.exit(1);
}, 15000);
