import { randomUUID } from "node:crypto";

const DEFAULT_USER = "demo-owner";

const defaultDevices = [
  {
    deviceId: "lock-lab-001",
    id: "lock-lab-001",
    name: "Lab Door Lock",
    type: "Smart Lock",
    access: "granted",
    status: "online",
    state: { locked: true },
  },
  {
    deviceId: "lamp-demo-002",
    id: "lamp-demo-002",
    name: "Booth Light",
    type: "Light",
    access: "pending",
    status: "online",
    state: { brightness: 0 },
  },
  {
    deviceId: "speaker-room-003",
    id: "speaker-room-003",
    name: "Meeting Speaker",
    type: "Speaker",
    access: "expired",
    status: "offline",
    state: {},
  },
];

export function createMockRuntime(options = {}) {
  const devices = normalizeDevices(options.devices?.length ? options.devices : defaultDevices);
  const access = new Map();

  for (const device of devices) {
    if (device.access === "granted") {
      access.set(accessKey(DEFAULT_USER, device.deviceId), Number.MAX_SAFE_INTEGER);
    }
  }

  return {
    listDevices: async (context = {}) => {
      const userAddress = context.userAddress ?? DEFAULT_USER;
      return devices.map((device) => ({
        ...device,
        access: isAllowed(access, userAddress, device.deviceId, device.access) ? "granted" : device.access,
      }));
    },

    checkAccess: async (deviceId, userAddress = DEFAULT_USER, context = {}) => {
      const device = findDevice(devices, deviceId);
      if (!device) return false;
      return isAllowed(access, userAddress, device.deviceId, device.access)
        || context.allowMockAccess === true;
    },

    executor: async (deviceId, command) => {
      const device = findDevice(devices, deviceId);
      if (!device) return { ok: false, error: "device not found", code: "device_not_found", deviceId };
      if (device.status === "offline") {
        return { ok: false, error: "device offline", code: "device_offline", deviceId };
      }

      const now = new Date().toISOString();
      const action = command.action;

      if (action === "lock") device.state.locked = true;
      if (action === "unlock") device.state.locked = false;
      if (action === "set_brightness") device.state.brightness = clamp(Number(command.value ?? 100), 0, 100);
      if (action === "set_temperature") device.state.temperature = Number(command.value ?? 24);
      if (!["lock", "unlock", "status", "set_brightness", "set_temperature"].includes(action)) {
        return { ok: false, error: `unknown action: ${action}`, code: "unknown_action", deviceId, action };
      }

      return {
        ok: true,
        requestId: randomUUID(),
        deviceId: device.deviceId,
        action,
        state: { ...device.state },
        transport: "mock-executor",
        receivedAt: now,
        source: "mock-ai-runtime",
      };
    },

    grantAccess: async ({ deviceId, userAddress, expiry, durationHours }, context = {}) => {
      const device = findDevice(devices, deviceId);
      if (!device) return { ok: false, error: "device not found", code: "device_not_found", deviceId };

      const grantedTo = userAddress ?? context.userAddress ?? "visitor-demo";
      const expiresAtMs = expiry
        ? Number(expiry) * 1000
        : Date.now() + Number(durationHours ?? 4) * 60 * 60 * 1000;
      access.set(accessKey(grantedTo, device.deviceId), Math.floor(expiresAtMs / 1000));

      return {
        ok: true,
        granted: true,
        deviceId: device.deviceId,
        userAddress: grantedTo,
        expiry: Math.floor(expiresAtMs / 1000),
        expiresAt: new Date(expiresAtMs).toISOString(),
        source: "mock-ai-runtime",
      };
    },
  };
}

function normalizeDevices(devices) {
  return devices.map((device) => ({
    ...device,
    deviceId: device.deviceId ?? device.id,
    id: device.id ?? device.deviceId,
    name: device.name ?? device.deviceId ?? device.id,
    type: device.type ?? "Unknown",
    access: device.access ?? "granted",
    status: device.status ?? "online",
    state: {
      locked: inferLocked(device),
      ...(device.state ?? {}),
    },
  }));
}

function inferLocked(device) {
  if (typeof device.locked === "boolean") return device.locked;
  if (device.state && "locked" in device.state) return device.state.locked;
  return `${device.type ?? ""} ${device.name ?? ""}`.toLowerCase().includes("lock") ? true : undefined;
}

function findDevice(devices, deviceId) {
  return devices.find((device) => device.deviceId === deviceId || device.id === deviceId);
}

function accessKey(userAddress, deviceId) {
  return `${userAddress ?? DEFAULT_USER}:${deviceId}`;
}

function isAllowed(access, userAddress, deviceId, defaultAccess) {
  if (defaultAccess === "granted") return true;
  const expiry = access.get(accessKey(userAddress, deviceId));
  return Boolean(expiry && expiry > Math.floor(Date.now() / 1000));
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
