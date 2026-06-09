const LOCK_WORDS = ["lock", "locked", "close", "secure", "\u4e0a\u9501", "\u9501\u4e0a", "\u9501\u95e8", "\u5173\u95e8"];
const UNLOCK_WORDS = ["unlock", "open", "\u5f00\u9501", "\u89e3\u9501", "\u5f00\u95e8"];
const STATUS_WORDS = ["status", "state", "\u72b6\u6001", "\u600e\u4e48\u6837"];
const LIGHT_WORDS = ["light", "lamp", "brightness", "\u706f", "\u4eae\u5ea6", "\u5f00\u706f", "\u5173\u706f", "\u7167\u660e"];
const TEMP_WORDS = ["temperature", "temp", "air", "ac", "\u7a7a\u8c03", "\u6e29\u5ea6", "\u8c03\u6e29", "\u5236\u51b7", "\u5236\u70ed", "\u5ea6\u6570", "\u5ea6"];
const LIST_WORDS = ["devices", "device list", "what devices", "\u6709\u54ea\u4e9b", "\u8bbe\u5907"];
const GRANT_WORDS = ["grant", "authorize", "access", "visitor", "guest", "\u6388\u6743", "\u8bbf\u5ba2", "\u4fdd\u6d01"];

export async function planLocalToolCalls(message, context = {}) {
  const text = String(message ?? "").trim();
  const lowered = text.toLowerCase();
  const devices = await resolveDevices(context);

  if (!text) return [];

  if (containsAny(lowered, LIST_WORDS) && !containsAny(lowered, LOCK_WORDS) && !containsAny(lowered, UNLOCK_WORDS)) {
    return [{ name: "list_devices", args: {} }];
  }

  if (containsAny(lowered, GRANT_WORDS) && !containsAny(lowered, LOCK_WORDS) && !containsAny(lowered, UNLOCK_WORDS)) {
    const device = pickDevice(text, devices, "lock") ?? devices[0];
    return [{
      name: "grant_access",
      args: {
        deviceId: device?.deviceId ?? device?.id ?? "lock-lab-001",
        userAddress: inferVisitor(text),
        durationHours: inferDurationHours(text),
      },
    }];
  }

  const device = pickDevice(text, devices);
  if (!device) return [{ name: "list_devices", args: {} }];

  if (containsAny(lowered, UNLOCK_WORDS)) {
    return [{ name: "control_device", args: { deviceId: getDeviceId(device), action: "unlock" } }];
  }
  if (containsAny(lowered, LOCK_WORDS)) {
    return [{ name: "control_device", args: { deviceId: getDeviceId(device), action: "lock" } }];
  }
  if (containsAny(lowered, STATUS_WORDS)) {
    return [{ name: "control_device", args: { deviceId: getDeviceId(device), action: "status" } }];
  }
  if (containsAny(lowered, LIGHT_WORDS)) {
    return [{
      name: "control_device",
      args: { deviceId: getDeviceId(device), action: "set_brightness", value: inferNumber(text, 100) },
    }];
  }
  if (containsAny(lowered, TEMP_WORDS)) {
    return [{
      name: "control_device",
      args: { deviceId: getDeviceId(device), action: "set_temperature", value: inferNumber(text, 24) },
    }];
  }

  return [{ name: "list_devices", args: {} }];
}

export function summarizeLocalReply({ message, toolResults }) {
  const result = toolResults.at(-1)?.result;
  if (!result) return "I checked the request, but no tool result was produced.";

  if (result.code === "unauthorized") {
    return `Blocked: this wallet is not authorized to control ${result.deviceId}.`;
  }
  if (result.error) {
    return `I could not complete the request: ${result.error}.`;
  }
  if (Array.isArray(result.devices)) {
    const names = result.devices.map((device) => device.name ?? device.deviceId ?? device.id).join(", ");
    return names ? `Available devices: ${names}.` : "No devices are available yet.";
  }
  if (result.granted) {
    return `Access granted for ${result.deviceId} until ${result.expiresAt}.`;
  }
  if (result.ok && result.action) {
    return `Done: ${result.action} was sent to ${result.deviceId}.`;
  }
  if (result.ok && result.state) {
    return `Done. ${result.deviceId} is now ${result.state.locked === false ? "unlocked" : "locked"}.`;
  }

  return `I handled: ${message}`;
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

async function resolveDevices(context) {
  if (Array.isArray(context.devices) && context.devices.length > 0) return context.devices;
  if (typeof context.listDevices === "function") return context.listDevices(context);
  return [];
}

function pickDevice(message, devices, forcedKind) {
  const lowered = message.toLowerCase();
  const kind = forcedKind
    ?? (containsAny(lowered, LIGHT_WORDS) ? "light"
      : containsAny(lowered, TEMP_WORDS) ? "temperature"
        : "lock");

  return devices.find((device) => {
    const haystack = `${device.deviceId ?? device.id ?? ""} ${device.name ?? ""} ${device.type ?? ""}`.toLowerCase();
    if (kind === "light") return haystack.includes("light") || haystack.includes("lamp");
    if (kind === "temperature") return haystack.includes("air") || haystack.includes("temperature") || haystack.includes("ac");
    return haystack.includes("lock") || haystack.includes("door");
  }) ?? devices.find((device) => device.access === "granted") ?? devices[0];
}

function getDeviceId(device) {
  return device.deviceId ?? device.id;
}

function inferNumber(message, fallback) {
  const match = message.match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function inferVisitor(message) {
  const tronLike = message.match(/T[A-Za-z0-9]{8,}/)?.[0];
  return tronLike ?? "visitor-demo";
}

function inferDurationHours(message) {
  if (message.includes("\u660e\u5929") || message.toLowerCase().includes("tomorrow")) return 24;
  const hourMatch = message.match(/(\d+)\s*(h|hour|hours|\u5c0f\u65f6)/i);
  return hourMatch ? Number(hourMatch[1]) : 4;
}
