/**
 * Routes AI tool calls to authorization and device execution adapters.
 *
 * The router is intentionally adapter-driven: today it can run on a local mock
 * registry/executor, and later the same contract can be backed by TRON
 * checkAccess plus the WebRTC P2P executor.
 */

export class DeviceRouter {
  /**
   * @param {object} opts
   * @param {(deviceId:string, command:object, context?:object)=>Promise<object>} opts.executor
   * @param {(context?:object)=>Promise<Array<object>>} opts.listDevices
   * @param {(deviceId:string, userAddress?:string, context?:object)=>Promise<boolean>} [opts.checkAccess]
   * @param {(args:object, context?:object)=>Promise<object>} [opts.grantAccess]
   */
  constructor({ executor, listDevices, checkAccess, grantAccess }) {
    if (typeof executor !== "function") throw new TypeError("DeviceRouter requires an executor");
    if (typeof listDevices !== "function") throw new TypeError("DeviceRouter requires listDevices");

    this.executor = executor;
    this.listDevices = listDevices;
    this.checkAccess = checkAccess ?? (async () => true);
    this.grantAccess = grantAccess;
  }

  /**
   * Handles one AI tool call and returns a structured tool result.
   */
  async handleToolCall(name, args = {}, context = {}) {
    switch (name) {
      case "list_devices": {
        const devices = await this.listDevices(context);
        return { ok: true, devices };
      }
      case "control_device": {
        const { deviceId, action, value } = args;
        if (!deviceId || !action) {
          return { ok: false, error: "missing deviceId or action", code: "bad_request" };
        }

        const allowed = await this.checkAccess(deviceId, context.userAddress, context);
        if (!allowed) {
          return { ok: false, error: "unauthorized", code: "unauthorized", deviceId, action };
        }

        return this.executor(deviceId, { action, value }, context);
      }
      case "grant_access": {
        if (!this.grantAccess) {
          return { ok: false, error: "grant_access is not configured", code: "not_configured" };
        }
        return this.grantAccess(args, context);
      }
      default:
        return { ok: false, error: `unknown tool: ${name}`, code: "unknown_tool" };
    }
  }
}
