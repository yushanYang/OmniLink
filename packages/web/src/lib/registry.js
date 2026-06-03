import { mockDevices } from "../data/mockDevices";
import { apiConfig, buildUrl } from "./config";
import { requestJson } from "./http";

export async function fetchDevices() {
  const url = buildUrl(apiConfig.registryBaseUrl, "/devices");
  if (!url) return mockDevices;

  try {
    const result = await requestJson(url);
    const devices = Array.isArray(result) ? result : result.devices;
    return Array.isArray(devices) ? devices : mockDevices;
  } catch (error) {
    console.warn("[OmniLink] registry API failed, using mock devices.", error);
    return mockDevices;
  }
}

export async function checkAccess(walletAddress, deviceId) {
  const url = buildUrl(apiConfig.registryBaseUrl, "/access/check");
  if (url) {
    try {
      const result = await requestJson(url, {
        method: "POST",
        body: JSON.stringify({ walletAddress, deviceId }),
      });

      return {
        allowed: Boolean(result.allowed),
        walletAddress,
        deviceId,
        expiresAt: result.expiresAt ?? "Unknown",
        source: "registry-api",
      };
    } catch (error) {
      console.warn("[OmniLink] checkAccess API failed, using mock result.", error);
      return mockCheckAccess(walletAddress, deviceId, error.message);
    }
  }

  return mockCheckAccess(walletAddress, deviceId);
}

export async function grantAccess({ walletAddress, deviceId, durationHours }) {
  const url = buildUrl(apiConfig.registryBaseUrl, "/access/grant");
  if (url) {
    try {
      const result = await requestJson(url, {
        method: "POST",
        body: JSON.stringify({ walletAddress, deviceId, durationHours }),
      });

      return {
        ok: Boolean(result.ok),
        txId: result.txId,
        walletAddress,
        deviceId,
        durationHours,
        source: "registry-api",
      };
    } catch (error) {
      console.warn("[OmniLink] grantAccess API failed, using mock result.", error);
      return mockGrantAccess({ walletAddress, deviceId, durationHours }, error.message);
    }
  }

  return mockGrantAccess({ walletAddress, deviceId, durationHours });
}

function mockCheckAccess(walletAddress, deviceId, fallbackReason) {
  const device = mockDevices.find((item) => item.id === deviceId);
  return {
    allowed: device?.access === "granted",
    walletAddress,
    deviceId,
    expiresAt: device?.expiresAt ?? "Unknown",
    source: "mock-registry",
    fallbackReason,
  };
}

function mockGrantAccess({ walletAddress, deviceId, durationHours }, fallbackReason) {
  return {
    ok: true,
    txId: "mock-tx-" + Math.random().toString(16).slice(2, 10),
    walletAddress,
    deviceId,
    durationHours,
    source: "mock-registry",
    fallbackReason,
  };
}
