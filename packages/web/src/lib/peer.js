import { apiConfig, buildUrl } from "./config";
import { requestJson } from "./http";

export async function sendDeviceCommand({ deviceId, action }) {
  const url = buildUrl(apiConfig.peerBaseUrl, "/commands");
  if (url) {
    try {
      const result = await requestJson(url, {
        method: "POST",
        body: JSON.stringify({ deviceId, action }),
      });

      return {
        ok: Boolean(result.ok),
        requestId: result.requestId,
        deviceId: result.deviceId ?? deviceId,
        action: result.action ?? action,
        transport: result.transport ?? "p2p-api",
        receivedAt: result.receivedAt ?? new Date().toLocaleTimeString(),
        source: "peer-api",
      };
    } catch (error) {
      console.warn("[OmniLink] peer API failed, using mock command result.", error);
      return mockDeviceCommand({ deviceId, action }, error.message);
    }
  }

  return mockDeviceCommand({ deviceId, action });
}

async function mockDeviceCommand({ deviceId, action }, fallbackReason) {
  await new Promise((resolve) => setTimeout(resolve, 420));

  return {
    ok: true,
    requestId: crypto.randomUUID(),
    deviceId,
    action,
    transport: "mock-p2p",
    receivedAt: new Date().toLocaleTimeString(),
    source: "mock-peer",
    fallbackReason,
  };
}
