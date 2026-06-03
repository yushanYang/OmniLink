import { apiConfig, buildUrl } from "./config";
import { requestJson } from "./http";

export async function askAgent({ message, devices }) {
  const url = buildUrl(apiConfig.aiBaseUrl, "/chat");
  if (url) {
    try {
      const result = await requestJson(url, {
        method: "POST",
        body: JSON.stringify({ message, devices }),
      });

      return {
        reply: result.reply ?? "Agent returned an empty reply.",
        toolCall: result.toolCall ?? null,
        source: "ai-api",
      };
    } catch (error) {
      console.warn("[OmniLink] AI API failed, using mock Agent result.", error);
      return mockAgentReply({ message, devices }, error.message);
    }
  }

  return mockAgentReply({ message, devices });
}

async function mockAgentReply({ message, devices }, fallbackReason) {
  await new Promise((resolve) => setTimeout(resolve, 520));

  const lowerMessage = message.toLowerCase();
  const device = lowerMessage.includes("light")
    ? devices.find((item) => item.type === "Light")
    : devices.find((item) => item.access === "granted") ?? devices[0];

  const action = lowerMessage.includes("unlock") || message.includes("开")
    ? "unlock"
    : lowerMessage.includes("light") || message.includes("灯")
      ? "turn_on"
      : "lock";

  return {
    reply: `I can ${action.replace("_", " ")} ${device.name}. Authorization check is mocked for now.`,
    toolCall: {
      name: "sendDeviceCommand",
      arguments: {
        deviceId: device.id,
        action,
      },
    },
    source: "mock-ai",
    fallbackReason,
  };
}
