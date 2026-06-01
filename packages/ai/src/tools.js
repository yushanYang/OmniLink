/**
 * AI 管家可调用的设备控制工具（Function Calling schema）。
 *
 * MVP（冲刺计划 Day 4）：第 1 层 —— 自然语言单/多设备控制。
 * 这些 schema 描述 AI 能下发的标准化指令；实际执行由 router 经 P2P 通道完成。
 */

export const deviceTools = [
  {
    type: "function",
    function: {
      name: "control_device",
      description:
        "对一台智能设备下发控制指令。例如锁门、解锁、调灯、设置空调温度。可跨品牌统一调度。",
      parameters: {
        type: "object",
        properties: {
          deviceId: {
            type: "string",
            description: "目标设备的 DID，例如 omnilink-lock-001",
          },
          action: {
            type: "string",
            description: "动作指令",
            enum: ["lock", "unlock", "status", "set_brightness", "set_temperature"],
          },
          value: {
            type: "number",
            description: "可选数值参数，如亮度(0-100)或温度(摄氏度)",
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
      description: "列出当前用户有权访问的所有设备（来自链上授权校验）。",
      parameters: { type: "object", properties: {} },
    },
  },
];

export const SYSTEM_PROMPT = `你是 OmniLink 的全屋 AI 管家。
你能管理用户名下来自不同品牌的全部智能设备，因为底层通信已去中心化、授权走链上。
收到用户自然语言后，解析成对具体设备的标准化指令并调用相应工具。
若用户未指明设备但意图明确（如"把门锁上"），从可用设备里选择最匹配的门锁。
执行前所有指令都会经过链上授权校验，无权限的操作会被拒绝。`;
