/**
 * AI 管家控制层入口：自然语言 → LLM Function Calling → 设备指令。
 */
import OpenAI from "openai";
import { deviceTools, SYSTEM_PROMPT } from "./tools.js";
import { DeviceRouter } from "./router.js";

export { DeviceRouter, deviceTools, SYSTEM_PROMPT };

/**
 * 创建一个 AI 管家实例。
 * @param {object} opts
 * @param {DeviceRouter} opts.router  设备指令路由器
 * @param {string} [opts.apiKey]
 * @param {string} [opts.baseURL]
 * @param {string} [opts.model]
 */
export function createButler({ router, apiKey, baseURL, model }) {
  const client = new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
    baseURL: baseURL || process.env.OPENAI_BASE_URL,
  });
  const chatModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const history = [{ role: "system", content: SYSTEM_PROMPT }];

  /**
   * 处理一句用户自然语言，执行可能的设备控制，返回管家的回复文本。
   */
  async function chat(userText) {
    history.push({ role: "user", content: userText });

    // 第一次请求：可能产生工具调用
    let response = await client.chat.completions.create({
      model: chatModel,
      messages: history,
      tools: deviceTools,
    });

    let msg = response.choices[0].message;
    history.push(msg);

    // 执行所有工具调用并回灌结果，直到模型给出自然语言回复
    while (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const call of msg.tool_calls) {
        const args = JSON.parse(call.function.arguments || "{}");
        const result = await router.handleToolCall(call.function.name, args);
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      response = await client.chat.completions.create({
        model: chatModel,
        messages: history,
        tools: deviceTools,
      });
      msg = response.choices[0].message;
      history.push(msg);
    }

    return msg.content;
  }

  return { chat, history };
}
