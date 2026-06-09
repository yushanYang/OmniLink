/**
 * Unit tests for DeviceRouter (src/router.js)
 *
 * Coverage:
 *   - list_devices: returns structured device list
 *   - control_device: permission granted → executor called
 *   - control_device: permission denied → unauthorized error
 *   - control_device: missing required args → bad_request error
 *   - grant_access: configured handler → delegates correctly
 *   - grant_access: not configured → not_configured error
 *   - unknown tool name → unknown_tool error
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DeviceRouter } from "../src/router.js";

// ---------------------------------------------------------------------------
// Construction validation
// ---------------------------------------------------------------------------

test("DeviceRouter: throws if executor is not a function", () => {
  assert.throws(
    () => new DeviceRouter({ executor: null, listDevices: async () => [] }),
    /requires an executor/
  );
});

test("DeviceRouter: throws if listDevices is not a function", () => {
  assert.throws(
    () => new DeviceRouter({ executor: async () => ({}), listDevices: "nope" }),
    /requires listDevices/
  );
});

// ---------------------------------------------------------------------------
// list_devices
// ---------------------------------------------------------------------------

test("list_devices: returns ok with device array", async () => {
  const mockDevices = [
    { deviceId: "lock-001", name: "Front Door", type: "Smart Lock" },
    { deviceId: "light-002", name: "Desk Lamp", type: "Light" },
  ];
  const router = new DeviceRouter({
    executor: async () => ({}),
    listDevices: async () => mockDevices,
  });

  const result = await router.handleToolCall("list_devices");

  assert.equal(result.ok, true);
  assert.deepEqual(result.devices, mockDevices);
  assert.equal(result.devices.length, 2);
});

test("list_devices: passes context to listDevices adapter", async () => {
  let receivedCtx;
  const router = new DeviceRouter({
    executor: async () => ({}),
    listDevices: async (ctx) => {
      receivedCtx = ctx;
      return [];
    },
  });

  const context = { userAddress: "TAbcdefg123456789012345678901234" };
  await router.handleToolCall("list_devices", {}, context);

  assert.deepEqual(receivedCtx, context);
});

// ---------------------------------------------------------------------------
// control_device — permission granted → executor called
// ---------------------------------------------------------------------------

test("control_device: executes when checkAccess allows", async () => {
  const executorCalls = [];
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async (deviceId, command, ctx) => {
      executorCalls.push({ deviceId, command, ctx });
      return { ok: true, deviceId, action: command.action, state: { locked: false } };
    },
  });

  const result = await router.handleToolCall(
    "control_device",
    { deviceId: "lock-lab-001", action: "unlock" },
    { userAddress: "owner-addr" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.deviceId, "lock-lab-001");
  assert.equal(result.action, "unlock");
  assert.equal(executorCalls.length, 1);
  assert.deepEqual(executorCalls[0].command, { action: "unlock", value: undefined });
});

test("control_device: passes value through to executor", async () => {
  let receivedCommand;
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async (deviceId, command) => {
      receivedCommand = command;
      return { ok: true, deviceId, action: command.action };
    },
  });

  await router.handleToolCall("control_device", {
    deviceId: "light-002",
    action: "set_brightness",
    value: 75,
  });

  assert.deepEqual(receivedCommand, { action: "set_brightness", value: 75 });
});

// ---------------------------------------------------------------------------
// control_device — permission denied → unauthorized
// ---------------------------------------------------------------------------

test("control_device: returns unauthorized when checkAccess denies", async () => {
  let executorCalled = false;
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => false,
    executor: async () => {
      executorCalled = true;
      return { ok: true };
    },
  });

  const result = await router.handleToolCall("control_device", {
    deviceId: "lamp-demo-002",
    action: "set_brightness",
    value: 80,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "unauthorized");
  assert.equal(result.error, "unauthorized");
  assert.equal(result.deviceId, "lamp-demo-002");
  assert.equal(result.action, "set_brightness");
  assert.equal(executorCalled, false, "executor must NOT be called when unauthorized");
});

// ---------------------------------------------------------------------------
// control_device — missing required parameters → bad_request
// ---------------------------------------------------------------------------

test("control_device: returns bad_request when deviceId is missing", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async () => ({ ok: true }),
  });

  const result = await router.handleToolCall("control_device", { action: "lock" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "bad_request");
  assert.match(result.error, /missing/i);
});

test("control_device: returns bad_request when action is missing", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async () => ({ ok: true }),
  });

  const result = await router.handleToolCall("control_device", { deviceId: "lock-001" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "bad_request");
  assert.match(result.error, /missing/i);
});

test("control_device: returns bad_request when args is empty", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async () => ({ ok: true }),
  });

  const result = await router.handleToolCall("control_device", {});

  assert.equal(result.ok, false);
  assert.equal(result.code, "bad_request");
});

test("control_device: returns bad_request when args is undefined", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async () => ({ ok: true }),
  });

  const result = await router.handleToolCall("control_device");

  assert.equal(result.ok, false);
  assert.equal(result.code, "bad_request");
});

// ---------------------------------------------------------------------------
// grant_access — configured → delegates to handler
// ---------------------------------------------------------------------------

test("grant_access: delegates to grantAccess handler when configured", async () => {
  let receivedArgs, receivedCtx;
  const router = new DeviceRouter({
    listDevices: async () => [],
    executor: async () => ({}),
    grantAccess: async (args, ctx) => {
      receivedArgs = args;
      receivedCtx = ctx;
      return { ok: true, granted: true, deviceId: args.deviceId };
    },
  });

  const args = { deviceId: "lock-001", userAddress: "visitor-1", durationHours: 2 };
  const ctx = { userAddress: "owner-addr" };
  const result = await router.handleToolCall("grant_access", args, ctx);

  assert.equal(result.ok, true);
  assert.equal(result.granted, true);
  assert.deepEqual(receivedArgs, args);
  assert.deepEqual(receivedCtx, ctx);
});

// ---------------------------------------------------------------------------
// grant_access — not configured → not_configured
// ---------------------------------------------------------------------------

test("grant_access: returns not_configured when grantAccess is undefined", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    executor: async () => ({}),
    // grantAccess intentionally omitted
  });

  const result = await router.handleToolCall("grant_access", {
    deviceId: "lock-001",
    userAddress: "visitor-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "not_configured");
  assert.match(result.error, /not configured/i);
});

// ---------------------------------------------------------------------------
// unknown tool → unknown_tool
// ---------------------------------------------------------------------------

test("unknown tool: returns unknown_tool code", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    executor: async () => ({}),
  });

  const result = await router.handleToolCall("nonexistent_tool", { foo: "bar" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "unknown_tool");
  assert.match(result.error, /unknown tool/i);
});

test("unknown tool: includes the tool name in error message", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    executor: async () => ({}),
  });

  const result = await router.handleToolCall("reboot_server");

  assert.equal(result.ok, false);
  assert.match(result.error, /reboot_server/);
});

// ---------------------------------------------------------------------------
// Default checkAccess behavior (no checkAccess provided → always allowed)
// ---------------------------------------------------------------------------

test("control_device: defaults to allowed when checkAccess is not provided", async () => {
  const router = new DeviceRouter({
    listDevices: async () => [],
    executor: async (deviceId, command) => ({ ok: true, deviceId, action: command.action }),
    // checkAccess intentionally omitted
  });

  const result = await router.handleToolCall("control_device", {
    deviceId: "lock-001",
    action: "unlock",
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "unlock");
});
