import test from "node:test";
import assert from "node:assert/strict";
import { DeviceRouter } from "../src/router.js";
import { createMockRuntime } from "../src/mock-runtime.js";

test("list_devices returns structured device list", async () => {
  const router = new DeviceRouter(createMockRuntime());

  const result = await router.handleToolCall("list_devices");

  assert.equal(result.ok, true);
  assert.ok(result.devices.length >= 1);
});

test("control_device calls executor when checkAccess allows", async () => {
  const calls = [];
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => true,
    executor: async (deviceId, command) => {
      calls.push({ deviceId, command });
      return { ok: true, deviceId, action: command.action };
    },
  });

  const result = await router.handleToolCall("control_device", {
    deviceId: "lock-lab-001",
    action: "lock",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    deviceId: "lock-lab-001",
    command: { action: "lock", value: undefined },
  });
});

test("control_device blocks unauthorized commands before executor", async () => {
  let executed = false;
  const router = new DeviceRouter({
    listDevices: async () => [],
    checkAccess: async () => false,
    executor: async () => {
      executed = true;
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
  assert.equal(executed, false);
});

test("mock runtime can grant access and then allow control", async () => {
  const runtime = createMockRuntime();
  const router = new DeviceRouter(runtime);
  const context = { userAddress: "visitor-demo" };

  const before = await router.handleToolCall("control_device", {
    deviceId: "lamp-demo-002",
    action: "set_brightness",
    value: 70,
  }, context);
  assert.equal(before.code, "unauthorized");

  const grant = await router.handleToolCall("grant_access", {
    deviceId: "lamp-demo-002",
    userAddress: "visitor-demo",
    durationHours: 1,
  }, context);
  assert.equal(grant.ok, true);

  const after = await router.handleToolCall("control_device", {
    deviceId: "lamp-demo-002",
    action: "set_brightness",
    value: 70,
  }, context);
  assert.equal(after.ok, true);
  assert.equal(after.state.brightness, 70);
});

test("unknown tool returns structured error", async () => {
  const router = new DeviceRouter(createMockRuntime());

  const result = await router.handleToolCall("missing_tool");

  assert.equal(result.ok, false);
  assert.equal(result.code, "unknown_tool");
});
