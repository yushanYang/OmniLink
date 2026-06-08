/**
 * Function Calling schemas exposed by the OmniLink AI butler.
 */

export const deviceTools = [
  {
    type: "function",
    function: {
      name: "control_device",
      description:
        "Send a normalized command to one smart device, such as lock, unlock, status, set_brightness, or set_temperature.",
      parameters: {
        type: "object",
        properties: {
          deviceId: {
            type: "string",
            description: "Target device DID, for example lock-lab-001 or omnilink-lock-001.",
          },
          action: {
            type: "string",
            description: "Device action.",
            enum: ["lock", "unlock", "status", "set_brightness", "set_temperature"],
          },
          value: {
            type: "number",
            description: "Optional numeric value, such as brightness 0-100 or temperature in Celsius.",
          },
        },
        required: ["deviceId", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_devices",
      description: "List devices currently available to the user.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "grant_access",
      description: "Grant time-limited access to a visitor for a device.",
      parameters: {
        type: "object",
        properties: {
          deviceId: { type: "string", description: "Target device DID." },
          userAddress: { type: "string", description: "Visitor wallet address or demo identity." },
          expiry: { type: "number", description: "Unix timestamp. Use 0 for permanent access." },
          durationHours: { type: "number", description: "Fallback duration in hours if expiry is not provided." },
        },
        required: ["deviceId", "userAddress"],
      },
    },
  },
];

export const SYSTEM_PROMPT = `You are the OmniLink whole-home AI butler.
You translate user language into normalized device tool calls.
If the user gives a clear intent but no device id, call list_devices first, then choose the best matching available device.
Every control action is checked against on-chain authorization before execution.
When authorization is denied, explain that the command was blocked instead of pretending it ran.

Chinese commands are common. Treat these as direct device-control intents:
- "把门锁上" / "锁门" -> list_devices, then control_device with action "lock" on the best Smart Lock.
- "开门" / "解锁" -> list_devices, then control_device with action "unlock" on the best Smart Lock.
- "有哪些设备" -> list_devices.

Do not answer with generic examples when the user asks for a concrete device action. Use tools.`;
