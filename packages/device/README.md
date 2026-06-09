# 📡 @omnilink/device — P2P 传输层

虚拟智能设备 + WebSocket Signaling + WebRTC P2P 通道。数据在用户端与设备之间**直接传输**，不经业务服务器。

---

## 📖 目录

- [模块概览](#模块概览)
- [快速启动](#快速启动)
- [虚拟设备类型](#虚拟设备类型)
- [Signaling Server](#signaling-server)
- [P2P 连接流程](#p2p-连接流程)
- [通信协议](#通信协议)
- [环境变量](#环境变量)
- [测试](#测试)
- [设计说明](#设计说明)

---

## 模块概览

| 文件 | 说明 |
|------|------|
| `src/signaling-server.js` | 简易 WebSocket signaling（仅转发 SDP/ICE，不碰数据） |
| `src/peer-channel.js` | `simple-peer` + `@roamhq/wrtc` 的 P2P 通道封装，设备端/客户端共用 |
| `src/lock.js` | 虚拟智能门锁：自注册 DID → 等待 P2P 连接 → 执行 lock/unlock |
| `src/virtual-device.js` | 通用虚拟设备（灯、空调、音箱等），通过环境变量切换类型 |
| `src/client-example.js` | P2P 客户端示例（initiator 端） |
| `src/p2p-smoke.js` | 端到端冒烟测试（signaling + 门锁 + 客户端） |

---

## 快速启动

### 启动 Signaling 服务器

```bash
# 方式 1：从仓库根目录
npm run signaling

# 方式 2：从包目录
npm run signaling -w @omnilink/device
```

默认监听 `ws://localhost:8080`。

### 启动虚拟门锁

```bash
# 新终端
npm run device

# 或指定设备 ID
DEVICE_ID=my-lock-001 npm run device -w @omnilink/device
```

门锁启动后会：
1. 尝试在 TRON 链上注册设备 DID（需配置 `TRON_PRIVATE_KEY` 和 `DEVICE_REGISTRY_ADDRESS`）
2. 若链上配置缺失，以本地模式运行
3. 连接 signaling 服务器，以 `DEVICE_ID` 为房间名等待 P2P 连接
4. 收到指令后执行并回传结果，支持断线自动重连

### 启动其他虚拟设备

```bash
# 智能灯
npm run light -w @omnilink/device

# 空调
npm run ac -w @omnilink/device

# 音箱
npm run speaker -w @omnilink/device

# 自定义
DEVICE_ID=sensor-001 DEVICE_TYPE=sensor npm run virtual -w @omnilink/device
```

### 运行客户端示例

```bash
npm run client -w @omnilink/device
```

### 冒烟测试（端到端）

```bash
npm run smoke -w @omnilink/device
```

---

## 虚拟设备类型

| 类型 | 设备 ID 示例 | 支持的 action |
|------|-------------|---------------|
| `smart-lock` | `omnilink-lock-001` | `lock`, `unlock`, `status` |
| `light` | `lamp-demo-002` | `on`, `off`, `set_brightness`, `status` |
| `ac` | `ac-room-003` | `on`, `off`, `set_temperature`, `status` |
| `speaker` | `speaker-room-004` | `play`, `pause`, `set_volume`, `status` |

---

## Signaling Server

### 设计

- **职责单一**：仅做 SDP / ICE 候选的房间内转发，不存储、不参与数据传输
- **房间模型**：客户端发 `{ type: "join", room: "<deviceId>" }` 加入房间
- **全函数式消息处理**：任何坏输入都被丢弃且不抛错、不断连
- **零泄漏**：连接关闭时自动清理房间，空房间自动删除

### 消息格式

```jsonc
// 客户端 → signaling：加入房间
{ "type": "join", "room": "omnilink-lock-001" }

// 客户端 → signaling：WebRTC 信令
{ "type": "signal", "data": { /* SDP or ICE candidate */ } }

// signaling → 同房间其他人：转发信令
{ "type": "signal", "data": { /* SDP or ICE candidate */ } }
```

---

## P2P 连接流程

```
┌──────────┐         ┌───────────────┐         ┌──────────┐
│  客户端   │         │  Signaling    │         │  设备端   │
│(initiator)│         │  Server       │         │(receiver)│
└─────┬────┘         └───────┬───────┘         └─────┬────┘
      │  join room           │                        │
      │─────────────────────▶│   join room            │
      │                      │◀───────────────────────│
      │                      │                        │
      │  SDP offer           │                        │
      │─────────────────────▶│  forward SDP offer     │
      │                      │───────────────────────▶│
      │                      │                        │
      │                      │  SDP answer            │
      │  forward SDP answer  │◀───────────────────────│
      │◀─────────────────────│                        │
      │                      │                        │
      │  ICE candidates      │  ICE candidates        │
      │◀────────────────────▶│◀──────────────────────▶│
      │                      │                        │
      ╠══════════════════════╪════════════════════════╣
      │     WebRTC DataChannel 直连（P2P）             │
      │◀═════════════════════╪═══════════════════════▶│
      │                      │                        │
      │  { type: "command",  │                        │
      │    command: { action: "unlock" } }            │
      │═════════════════════════════════════════════▶ │
      │                      │                        │
      │  { type: "result", ok: true, state: {...} }  │
      │◀═════════════════════════════════════════════ │
```

---

## 通信协议

P2P DataChannel 上的 JSON 消息格式：

### 设备 → 客户端（连接建立时）

```json
{ "type": "hello", "state": { "deviceId": "omnilink-lock-001", "type": "smart-lock", "locked": true } }
```

### 客户端 → 设备（发送指令）

```json
{ "type": "command", "requestId": "uuid-xxx", "command": { "action": "unlock" } }
```

### 设备 → 客户端（返回结果）

```json
{ "type": "result", "requestId": "uuid-xxx", "ok": true, "state": { "locked": false } }
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SIGNALING_PORT` | `8080` | Signaling WebSocket 服务器端口 |
| `SIGNALING_URL` | `ws://localhost:8080` | 设备/客户端连接的 signaling 地址 |
| `DEVICE_ID` | `omnilink-lock-001` | 虚拟设备 ID（同时作为 signaling 房间名） |
| `DEVICE_TYPE` | `smart-lock` | 虚拟设备类型（light / ac / speaker） |
| `TRON_PRIVATE_KEY` | — | TRON 私钥（用于设备链上注册） |
| `TRON_FULL_NODE` | `https://nile.trongrid.io` | TRON 节点地址 |
| `DEVICE_REGISTRY_ADDRESS` | — | DeviceRegistry 合约地址 |

---

## 测试

```bash
npm test -w @omnilink/device
```

使用 Node.js 内置 test runner。

---

## 设计说明

### 关键妥协（一周冲刺）

- **Signaling 先走简易 WebSocket**：这是冲刺计划里明确的妥协，先保证 P2P 能通。"把 signaling 搬上链"是第 2 周的去中心化升级。
- **数据走 P2P 直连**：指令通过 WebRTC DataChannel 在用户端与门锁之间直接传输，不经业务服务器。
- **降级方案**：若跨网络打洞失败，演示时让设备与用户处于同一局域网即可（故事不变）。

### 已知边界（MVP）

- 当前 DID 注册需配置链上环境，未配置时为本地模拟
- `@roamhq/wrtc` 为原生模块（`wrtc` 的维护分支），安装较慢；若安装失败可在演示机上改用浏览器端设备模拟
- 支持断线后自动重新监听，但不支持同时多客户端连接同一设备（MVP 限制）
