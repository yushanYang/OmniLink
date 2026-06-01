/**
 * 指令路由：把 AI 解析出的 Function Call 路由到具体设备（经 P2P 通道下发）。
 *
 * MVP 阶段先用一个可注入的执行器（executor），便于在没有真实 P2P/链时单测。
 * 第 3 天联调时，把 executor 换成基于 @omnilink/device peer-channel 的真实下发。
 */

export class DeviceRouter {
  /**
   * @param {object} opts
   * @param {(deviceId:string, command:object)=>Promise<object>} opts.executor 实际下发指令的函数
   * @param {()=>Promise<Array<{deviceId:string,type:string}>>} opts.listDevices 列出有权设备
   */
  constructor({ executor, listDevices }) {
    this.executor = executor;
    this.listDevices = listDevices;
  }

  /**
   * 处理一个 AI 工具调用，返回结构化结果（回传给 LLM 作为 tool 输出）。
   */
  async handleToolCall(name, args) {
    switch (name) {
      case "list_devices": {
        const devices = await this.listDevices();
        return { devices };
      }
      case "control_device": {
        const { deviceId, action, value } = args;
        // TODO(Day4): 在这里之前插入链上 checkAccess 校验
        const result = await this.executor(deviceId, { action, value });
        return result;
      }
      default:
        return { ok: false, error: `unknown tool: ${name}` };
    }
  }
}
