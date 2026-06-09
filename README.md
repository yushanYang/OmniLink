# 🔗 OmniLink

**去中心化 IoT 互联与 AI 管家** — 让物联网设备摆脱厂商平台的层层认证，通过区块链直接与用户点对点（P2P）连接，并在此之上构建一个能管理全屋跨品牌设备的 AI 管家。

> 🏆 **参赛**：HTX Genesis 创世纪黑客松 · Genesis 赛道（AI × Web3） · 部署于 TRON
>
> 📜 **合约地址（TRON Nile 测试网）**：`TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx`

---

## 📖 目录

- [架构概览](#架构概览)
- [四层架构说明](#四层架构说明)
- [快速启动](#快速启动)
- [环境变量配置](#环境变量配置)
- [演示流程](#演示流程)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [License](#license)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户 / 前端 (React)                            │
│         钱包连接 · 设备列表 · AI 对话 · 授权管理 · P2P 控制            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP / WebSocket
┌────────────────────────────────▼────────────────────────────────────┐
│                     🧠 AI 管家层 (packages/ai)                       │
│       自然语言 → Function Calling → 链上授权校验 → 设备指令路由         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ WebRTC DataChannel (P2P 直连)
┌────────────────────────────────▼────────────────────────────────────┐
│                   📡 P2P 传输层 (packages/device)                     │
│       WebSocket Signaling → ICE/SDP 交换 → WebRTC 点对点数据通道       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ TronWeb RPC
┌────────────────────────────────▼────────────────────────────────────┐
│                  ⛓️ 链上信任层 (packages/contracts)                    │
│         设备身份 DID · 所有权绑定 · 带时间限制的授权/撤销 (TRON)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 四层架构说明

| 层 | 包 | 职责 |
|---|---|---|
| ⛓️ **链上信任层** | `packages/contracts` | `DeviceRegistry` 合约：设备 DID 注册、所有权一键认领、带 expiry 的授权/撤销、链上访问校验 |
| 📡 **P2P 传输层** | `packages/device` | 虚拟智能门锁、WebSocket signaling 服务器、WebRTC P2P 通道封装（simple-peer + wrtc） |
| 🧠 **AI 管家层** | `packages/ai` | 自然语言 → OpenAI Function Calling → DeviceRouter 适配器 → 链上授权校验 → P2P 指令下发 |
| 💻 **用户端** | `packages/web` | React SPA：TronLink 钱包连接、链上设备发现、P2P 实时控制、AI Agent 对话界面 |

---

## 快速启动

### Prerequisites

- **Node.js** >= 18
- **npm** >= 8（内置 workspaces 支持）
- **TronLink** 浏览器插件（前端钱包连接）
- TRON Nile 测试网测试币（[水龙头](https://nileex.io/join/getJoinPage)）

### Install

```bash
# 克隆仓库
git clone https://github.com/your-org/omnilink.git
cd omnilink

# 安装全部依赖（npm workspaces 自动链接各包）
npm install
```

### Configure

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env`，填入必要配置（详见[环境变量配置](#环境变量配置)）。

### Run

```bash
# 终端 1：启动 signaling 服务器（WebSocket 信令中转）
npm run signaling

# 终端 2：启动虚拟门锁（自动上链注册 DID，等待 P2P 连接）
npm run device

# 终端 3：启动 AI 管家 API 服务
npm run ai:serve

# 终端 4：启动前端开发服务器
npm run web
# → 打开 http://localhost:5173
```

或使用 CLI 模式快速体验 AI 管家：

```bash
npm run ai
# 输入: "解锁实验室门锁" / "给访客开明天下午的权限"
```

---

## 环境变量配置

在项目根目录 `.env` 文件中配置：

| 变量 | 必填 | 说明 | 示例 |
|------|:---:|------|------|
| `TRON_PRIVATE_KEY` | ✅ | TRON 账户私钥（用于合约部署和设备注册） | `0x...` |
| `TRON_FULL_NODE` | | TRON 节点地址 | `https://nile.trongrid.io` |
| `DEVICE_REGISTRY_ADDRESS` | ✅ | DeviceRegistry 合约地址 | `TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx` |
| `OPENAI_API_KEY` | | OpenAI API Key（AI 管家 LLM 调用） | `sk-...` |
| `AI_MODE` | | AI 运行模式：`auto`/`openai`/`local` | `auto` |
| `AI_EXECUTOR` | | 指令执行器：`mock`/`p2p` | `p2p` |
| `AI_PORT` | | AI API 监听端口 | `8787` |
| `SIGNALING_PORT` | | Signaling 服务器端口 | `8080` |
| `SIGNALING_URL` | | Signaling WebSocket 地址 | `ws://localhost:8080` |
| `DEVICE_ID` | | 虚拟设备 ID | `omnilink-lock-001` |

---

## 演示流程

> 📹 门锁主线（3-5 分钟演示场景）

```
1. 虚拟门锁启动 → 自动在 TRON 链上注册 DID（设备身份上链）
2. 用户用钱包"一键认领"门锁 → 所有权绑定上链
3. 用户对 AI 说"给保洁阿姨开明天下午 2-4 点的门锁权限"
   → AI 通过 Function Calling 在链上签发带时间限制的授权
4. 访客 App（模拟另一厂商生态）凭链上授权 P2P 直连门锁
5. 到点后授权在链上自动失效，全程无厂商服务器参与
```

---

## 技术栈

| 领域 | 技术 |
|------|------|
| 区块链 | TRON (Nile Testnet)、Solidity ^0.8.20、TronWeb v6 |
| P2P 通信 | WebRTC (simple-peer + @roamhq/wrtc)、WebSocket Signaling |
| AI | OpenAI GPT-4 Function Calling、本地规则引擎回退 |
| 前端 | React 18、Vite 5、Lucide Icons、TronLink |
| 后端 | Node.js 18+（ESM）、原生 HTTP Server |
| 合约工具 | solc ^0.8.26、自研轻量编译/部署脚本 |
| 测试 | Node.js 内置 test runner (`node --test`) |
| 包管理 | npm workspaces (monorepo) |

---

## 项目结构

```
omnilink/
├── .env.example                # 环境变量模板
├── package.json                # Workspace 根配置
├── README.md                   # 本文件
├── docs/
│   ├── api-contracts.md        # 前后端 API 约定
│   ├── backend-api-implementation.md
│   └── status.md               # 项目状态追踪
├── packages/
│   ├── contracts/              # ⛓️ 链上信任层
│   │   ├── contracts/
│   │   │   └── DeviceRegistry.sol
│   │   ├── scripts/
│   │   │   ├── compile.js
│   │   │   ├── deploy.js
│   │   │   └── deploy-local.js
│   │   ├── build/              # 编译产物（ABI + bytecode）
│   │   ├── deployments/
│   │   │   ├── nile.json       # TRON Nile 部署记录
│   │   │   └── local.json      # 本地 Ganache 部署记录
│   │   └── test/
│   ├── device/                 # 📡 P2P 传输层
│   │   ├── src/
│   │   │   ├── signaling-server.js
│   │   │   ├── peer-channel.js
│   │   │   ├── lock.js         # 虚拟智能门锁
│   │   │   ├── virtual-device.js
│   │   │   ├── client-example.js
│   │   │   └── p2p-smoke.js
│   │   └── test/
│   ├── ai/                     # 🧠 AI 管家层
│   │   ├── src/
│   │   │   ├── server.js       # HTTP API 服务
│   │   │   ├── cli.js          # CLI 交互模式
│   │   │   ├── index.js        # Butler + Router 导出
│   │   │   ├── tools.js        # Function Calling 工具定义
│   │   │   ├── router.js       # DeviceRouter 适配器
│   │   │   ├── mock-runtime.js # Mock 运行时
│   │   │   ├── chain-runtime.js # 链上运行时
│   │   │   ├── p2p-executor.js # P2P 指令执行器
│   │   │   ├── p2p-persistent.js
│   │   │   ├── ws-executor.js
│   │   │   ├── local-planner.js # 本地规则引擎
│   │   │   └── env.js
│   │   └── test/
│   └── web/                    # 💻 用户前端
│       ├── src/
│       ├── public/
│       ├── index.html
│       └── vite.config.js
└── OmniLink_立项方案.md         # 立项文档
```

---

## License

[MIT](./LICENSE)

---

<p align="center">
  Built with ❤️ for <strong>HTX Genesis Hackathon</strong> · Deployed on <strong>TRON</strong>
</p>
