# 🧠 @omnilink/ai — AI 管家层

自然语言 → OpenAI Function Calling → 链上授权校验 → 设备指令路由。

将用户的口语化命令转化为结构化设备操作，支持跨品牌设备的统一智能控制。

---

## 📖 目录

- [架构设计](#架构设计)
- [快速启动](#快速启动)
- [API 端点](#api-端点)
- [Function Calling 工具定义](#function-calling-工具定义)
- [运行模式](#运行模式)
- [适配器架构](#适配器架构)
- [环境变量](#环境变量)
- [测试](#测试)

---

## 架构设计

```
┌────────────────────┐
│  用户自然语言输入    │  "给保洁阿姨开明天下午的门锁权限"
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  AI Butler (OpenAI / Local Planner)         │
│  System Prompt + Function Calling           │
└─────────┬───────────────────────────────────┘
          │ tool_call: grant_access / control_device
          ▼
┌─────────────────────────────────────────────┐
│  DeviceRouter (适配器模式)                    │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ checkAccess  │  │ executor            │  │
│  │ (链上/Mock)   │  │ (P2P/WS/Mock)       │  │
│  └──────────────┘  └─────────────────────┘  │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  设备 (P2P 直连)     │  { action: "unlock" } → { ok: true }
└─────────────────────┘
```

---

## 快速启动

### CLI 模式（交互式体验）

```bash
# 从仓库根目录
npm run ai

# 或
npm run start -w @omnilink/ai
```

输入示例：
```
> lock the lab door
> 解锁实验室门锁
> 有哪些设备
> 把灯调到 50%
> 给访客开明天下午 2-4 点的门锁权限
```

### HTTP API 模式（供前端调用）

```bash
# 从仓库根目录
npm run ai:serve

# 或
npm run serve -w @omnilink/ai
```

默认监听 `http://0.0.0.0:8787`。

### 搭配真实 LLM

```bash
# .env 中配置
OPENAI_API_KEY=sk-...
AI_MODE=auto

npm run ai:serve
```

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查，返回服务状态 |
| `GET` | `/devices` | 列出可用设备 |
| `POST` | `/chat` | AI 对话（核心端点） |
| `POST` | `/commands` | 直接发送设备指令（绕过 AI） |
| `POST` | `/access/check` | 检查用户对设备的访问权 |
| `POST` | `/access/grant` | 授予用户设备访问权 |

### `GET /health`

```json
{
  "ok": true,
  "service": "OmniLink AI API",
  "chain": "tron-nile",
  "executor": "p2p",
  "mode": "auto",
  "openaiKeyConfigured": true
}
```

### `POST /chat`

**Request:**

```json
{
  "message": "解锁实验室门锁",
  "account": "TXxx...用户钱包地址",
  "sessionId": "session-001",
  "devices": [
    {
      "id": "lock-lab-001",
      "name": "Lab Door Lock",
      "type": "Smart Lock",
      "access": "granted",
      "status": "online"
    }
  ]
}
```

**Response:**

```json
{
  "ok": true,
  "sessionId": "session-001",
  "reply": "已为您解锁实验室门锁。",
  "toolCall": {
    "name": "sendDeviceCommand",
    "arguments": { "deviceId": "lock-lab-001", "action": "unlock" }
  },
  "toolResults": [
    {
      "name": "control_device",
      "args": { "deviceId": "lock-lab-001", "action": "unlock" },
      "result": { "ok": true }
    }
  ],
  "source": "openai",
  "model": "gpt-4"
}
```

### `POST /commands`

**Request:**

```json
{ "deviceId": "omnilink-lock-001", "action": "unlock" }
```

**Response:**

```json
{ "ok": true, "state": { "locked": false } }
```

### `POST /access/check`

**Request:**

```json
{ "deviceId": "omnilink-lock-001", "walletAddress": "TXxx..." }
```

**Response:**

```json
{ "ok": true, "allowed": true, "source": "chain" }
```

### `POST /access/grant`

**Request:**

```json
{ "deviceId": "omnilink-lock-001", "walletAddress": "TXxx...", "durationHours": 2 }
```

---

## Function Calling 工具定义

AI 管家暴露以下 OpenAI Function Calling 工具：

### `control_device`

向设备发送控制指令。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `deviceId` | string | ✅ | 目标设备 DID |
| `action` | string | ✅ | 操作：`lock` / `unlock` / `status` / `set_brightness` / `set_temperature` |
| `value` | number | | 数值参数（亮度 0-100 / 温度摄氏度） |

### `list_devices`

列出当前用户可用的设备列表。无参数。

### `grant_access`

授予访客对设备的限时访问权。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `deviceId` | string | ✅ | 目标设备 DID |
| `userAddress` | string | ✅ | 访客钱包地址或 demo 身份 |
| `expiry` | number | | Unix 时间戳；0 表示永久 |
| `durationHours` | number | | 若未提供 expiry，使用此时长（小时） |

### System Prompt 设计

```
You are the OmniLink whole-home AI butler.
- 将用户语言转化为标准化设备工具调用
- 支持中文命令（"锁门" → lock, "开门" → unlock）
- 每个控制动作都经过链上授权校验
- 授权被拒时如实告知用户，而非假装执行
```

---

## 运行模式

通过 `AI_MODE` 和 `AI_EXECUTOR` 环境变量组合切换三种运行模式：

### 模式矩阵

| AI_MODE | AI_EXECUTOR | 场景 | 说明 |
|---------|-------------|------|------|
| `auto` | `mock` | **默认/开发** | OpenAI 可用时用 LLM，否则回退本地规则引擎；设备操作走内存模拟 |
| `openai` | `mock` | **API 验证** | 强制使用 OpenAI，失败不回退；设备走模拟 |
| `auto` | `p2p` | **联调/演示** | AI 智能回退 + 真实 WebRTC P2P 连接设备 |
| `openai` | `p2p` | **完整演示** | 真实 LLM + 真实 P2P，全链路打通 |

### 模式详细说明

#### Mock 模式（默认）

- 无需启动 signaling / 设备
- 内置模拟设备列表和模拟执行器
- 适合前端开发和 AI 逻辑调试

```bash
AI_MODE=auto AI_EXECUTOR=mock npm run ai:serve
```

#### P2P 模式

- 需要先启动 signaling 服务器和虚拟设备
- 指令通过真实 WebRTC DataChannel 下发
- 持久连接：首次握手后保持 DataChannel，命令 <50ms 送达

```bash
AI_MODE=auto AI_EXECUTOR=p2p npm run ai:serve
```

#### Chain 模式（自动检测）

- 当 `DEVICE_REGISTRY_ADDRESS` 配置后自动启用
- `checkAccess` 从链上合约读取，非 mock
- `grantAccess` 真实写入链上
- 与 P2P/Mock executor 正交组合

---

## 适配器架构

`DeviceRouter` 采用适配器模式，各能力可独立替换：

```js
new DeviceRouter({
  // 列出设备：链上发现 / Web 传入 / Mock
  listDevices: async (context) => devices,

  // 授权校验：DeviceRegistry.checkAccess / Mock
  checkAccess: async (deviceId, userAddress, context) => boolean,

  // 指令执行：P2P WebRTC / WebSocket / Mock
  executor: async (deviceId, { action, value }, context) => result,

  // 授权签发：DeviceRegistry.grantAccess / Mock
  grantAccess: async (args, context) => result,
});
```

### 适配器替换路径

| 适配器 | Mock 实现 | 真实实现 |
|--------|-----------|----------|
| `checkAccess` | 内存 Map | `DeviceRegistry.checkAccess(deviceId, user)` |
| `executor` | 内存状态变更 | `createPersistentP2PExecutor({ signalingUrl })` |
| `listDevices` | 硬编码设备列表 | 链上 Registry 扫描 / Web 前端传入 |
| `grantAccess` | 内存 Map 写入 | `DeviceRegistry.grantAccess(deviceId, user, expiry)` |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | — | OpenAI API 密钥 |
| `AI_MODE` | `auto` | AI 模式：`auto`（有 key 用 OpenAI，无则回退）/ `openai`（强制）/ `local`（纯本地） |
| `AI_EXECUTOR` | `mock` | 执行器：`mock`（内存模拟）/ `p2p`（真实 WebRTC） |
| `AI_PORT` | `8787` | HTTP API 监听端口 |
| `AI_HOST` | `0.0.0.0` | HTTP API 监听地址 |
| `SIGNALING_URL` | `ws://localhost:8080` | Signaling 服务器地址（P2P 模式需要） |
| `AI_P2P_CONNECT_TIMEOUT` | `10000` | P2P 连接超时（ms） |
| `AI_P2P_CMD_TIMEOUT` | `5000` | P2P 命令响应超时（ms） |
| `TRON_PRIVATE_KEY` | — | TRON 私钥（链上授权操作） |
| `TRON_FULL_NODE` | `https://nile.trongrid.io` | TRON 节点 |
| `DEVICE_REGISTRY_ADDRESS` | — | 合约地址（配置后自动启用 chain runtime） |

---

## 测试

```bash
npm test -w @omnilink/ai
```

使用 Node.js 内置 test runner（`node --test --experimental-test-isolation=none`）。

---

## 目录结构

```
packages/ai/
├── src/
│   ├── server.js           # HTTP API 服务（/chat, /commands, /health 等）
│   ├── cli.js              # CLI 交互模式入口
│   ├── index.js            # 核心导出：createButler, DeviceRouter, createMockRuntime
│   ├── tools.js            # Function Calling 工具 schema + System Prompt
│   ├── router.js           # DeviceRouter 适配器路由
│   ├── local-planner.js    # 本地规则引擎（无 OpenAI 时的回退）
│   ├── mock-runtime.js     # Mock 运行时（模拟设备 + 模拟授权）
│   ├── chain-runtime.js    # 链上运行时（TronWeb + DeviceRegistry）
│   ├── p2p-executor.js     # P2P 指令执行器（单次连接）
│   ├── p2p-persistent.js   # 持久 P2P 执行器（保持 DataChannel）
│   ├── ws-executor.js      # WebSocket 直连执行器（无 WebRTC 回退）
│   └── env.js              # .env 加载工具
├── test/                   # 测试用例
├── package.json
└── README.md               # 本文件
```
