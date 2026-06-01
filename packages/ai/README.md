# @omnilink/ai — AI 管家层（项目皇冠）

自然语言 → LLM Function Calling → 跨设备标准化指令。这是 OmniLink 区别于单一生态语音助手的核心：因为底层接入已去中心化，AI 第一次拥有"跨厂商、统一授权"的设备控制身体。

## 模块

| 文件 | 说明 |
|------|------|
| `src/tools.js` | Function Calling 工具 schema + 管家 system prompt |
| `src/router.js` | 把工具调用路由到具体设备（可注入 executor，便于单测/联调） |
| `src/index.js` | `createButler()`：封装 LLM 多轮工具调用循环 |
| `src/cli.js` | 命令行 demo（带 mock 设备，无需真实 P2P 即可演示 AI 层） |

## 运行

```bash
# 在 .env 配置 OPENAI_API_KEY 后
npm run ai
```

示例对话：
```
你 > 把门锁上
  → [mock] omnilink-lock-001: lock
管家 > 已为你把 omnilink-lock-001 上锁。
```

## 范围（MVP）

- ✅ 第 1 层：自然语言单/多设备控制
- 🔜 第 2 层：跨设备场景编排（第 2-3 周）
- 🔜 第 3 层：主动式 Agent（演示高潮）

联调时把 `router` 的 `executor` 从 mock 换成基于 `@omnilink/device` peer-channel 的真实 P2P 下发，并在 `control_device` 前接入链上 `checkAccess` 校验。
