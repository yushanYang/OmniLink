import { randomUUID } from "node:crypto";
import { createPeerChannel } from "../../device/src/peer-channel.js";

/**
 * Creates an executor that sends commands over the shared WebRTC DataChannel
 * protocol implemented by packages/device/src/lock.js.
 */
export function createP2PExecutor({
  signalingUrl = process.env.SIGNALING_URL || "ws://localhost:8080",
  timeoutMs = Number(process.env.AI_P2P_TIMEOUT_MS || 12000),
  iceServers,
} = {}) {
  return async function executeOverP2P(deviceId, command) {
    return sendCommandOverP2P({ signalingUrl, timeoutMs, iceServers, deviceId, command });
  };
}

export function sendCommandOverP2P({ signalingUrl, timeoutMs = 12000, iceServers, deviceId, command }) {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    let channel;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel?.destroy();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error(`P2P command timed out for ${deviceId}`));
    }, timeoutMs);

    channel = createPeerChannel({
      signalingUrl,
      room: deviceId,
      initiator: true,
      iceServers,
      onConnect: () => {
        channel.send({ type: "command", requestId, command });
      },
      onData: (payload) => {
        if (payload?.type !== "result" || payload.requestId !== requestId) return;
        finish(resolve, {
          ...payload,
          deviceId: payload.deviceId ?? deviceId,
          action: command.action,
          requestId,
          transport: "p2p",
          source: "p2p-executor",
        });
      },
    });
  });
}
