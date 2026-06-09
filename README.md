# 🔗 OmniLink：去中心化 IoT 互联与 AI 管家

<p align="center">
  <strong>让 AI 第一次拥有"跨厂商统一控制所有智能设备"的身体</strong>
</p>

<p align="center">
  <a href="https://nile.tronscan.org/#/contract/TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx">🔗 链上合约 (TRON Nile)</a> ·
  <a href="#快速启动">🚀 快速启动</a> ·
  <a href="#演示流程">📺 演示视频</a> ·
  <a href="./OmniLink_立项方案.md">📋 立项方案</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/赛事-HTX_Genesis_创世纪黑客松-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/赛道-Genesis_(AI_×_Web3)-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/链-TRON_(Nile_Testnet)-red?style=flat-square" />
  <img src="https://img.shields.io/badge/合约-TBZFyN...QPcvNx-green?style=flat-square" />
</p>

---

## 💡 一句话定位

> 把设备的**身份、所有权与授权**搬到区块链上，让任何支持协议的客户端凭链上授权 **P2P 直连**设备——不再经过厂商中心化云平台。当这条统一的、跨厂商的设备通信通道建立起来后，AI 便获得了一个前所未有的"**统一身体**"：它可以管理用户名下的**全部**智能设备，无论出自哪个品牌。

---

## 🔥 为什么做这个？

### 传统 IoT 的结构性困局

```
设备 → 厂商认证 → 厂商IoT平台 → 企业云 → App → 用户
       ↑ 每一跳都是中心化依赖，每一跳都是锁定点
```

| 痛点 | 表现 | 根因 |
|------|------|------|
| 🔐 **厂商锁定** | 5 个品牌 = 5 个 App，互不互通 | 接入协议封闭 |
| 🕸️ **中心化依赖** | 厂商云停服 → 设备变砖 | 设备控制权不属于用户 |
| 🐢 **链路冗长** | 数据绕多个云平台，延迟高、隐私暴露面大 | 没有直连通道 |
| 🤖 **AI 被困在生态孤岛** | 小爱只能控小米、Siri 只能控 HomeKit | AI 没有统一设备控制通道 |

### OmniLink 的核心洞察

**去中心化不是目的，是手段。** 我们的目标是让 AI 获得"跨厂商统一控制设备"的能力——而这在传统封闭协议下永远不可能实现。只有把接入层去中心化（身份/授权上链 + P2P 直连），AI 才能第一次获得一个**统一的设备控制身体**。

```
OmniLink 架构：
设备 ←——（链上身份 + 授权 + 发现）——→ 用户/AI
            数据走 P2P 直连，信任走链上
```

---

## ⚡ 核心创新（vs 已有方案）

| 维度 | 传统 IoT 平台 | 已有 DePIN 项目 | **OmniLink** |
|------|:---:|:---:|:---:|
| 跨厂商互通 | ❌ 封闭生态 | ⚠️ 仅同协议设备 | ✅ 链上统一身份 + P2P 直连 |
| 用户控制权 | ❌ 厂商掌控 | ✅ 链上 | ✅ 链上所有权 + 可编程授权 |
| AI 全屋控制 | ❌ 单品牌 | ❌ 无 AI 层 | ✅ **AI Agent 管理链上授权** |
| 数据隐私 | ❌ 过厂商云 | ⚠️ 部分上链 | ✅ P2P 端到端 |
| 授权粒度 | ⚠️ 永久/手动 | ⚠️ 基础 | ✅ 链上带时间限制 + AI 代理签发 |

> **关键差异**：OmniLink 不只是"又一个 DePIN"——我们在去中心化基础设施之上构建了 **AI Agent 层**，让 AI 直接参与链上资产（设备授权）的管理。这精准命中 Genesis 赛道"AI × Web3"的核心标准。

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    💻 用户端 (packages/web)                           │
│       TronLink 钱包连接 · 设备发现 · AI 对话 · P2P 实时控制             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP + WebSocket
┌────────────────────────────────▼────────────────────────────────────┐
│                    🧠 AI 管家层 (packages/ai)                         │
│                                                                      │
│   用户："给保洁阿姨开明天下午2-4点的门锁权限"                             │
│                          ↓                                           │
│   LLM Function Calling → 解析意图 → 多设备路由                         │
│                          ↓                                           │
│   链上授权校验 (checkAccess) → P2P 指令下发 (WebRTC DataChannel)        │
│                                                                      │
│   支持：自然语言单/多设备控制 · AI代理签发链上授权 · 本地规则引擎降级        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ WebRTC DataChannel (P2P 直连，无中间人)
┌────────────────────────────────▼────────────────────────────────────┐
│                  📡 P2P 传输层 (packages/device)                      │
│                                                                      │
│   WebSocket Signaling（仅建连时使用）→ ICE/SDP 交换 → WebRTC 点对点      │
│   · 建连后 signaling 可下线，已有连接不受影响（去中心化关键证明）           │
│   · 持久连接池：首次握手后保持 DataChannel，命令 <50ms 送达               │
│   · 指数退避重连 + 心跳保活 + 连接池自动清理                              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ TronWeb RPC
┌────────────────────────────────▼────────────────────────────────────┐
│                ⛓️ 链上信任层 (packages/contracts)                      │
│                                                                      │
│   DeviceRegistry 合约 (Solidity ^0.8.20, 部署于 TRON Nile)            │
│   · registerDevice(deviceId, pubkey, connInfo) — 设备DID上链           │
│   · bindOwner(deviceId) — 所有权一键认领                               │
│   · grantAccess(deviceId, user, expiry) — 带时间限制的授权签发          │
│   · revokeAccess(deviceId, user) — 即时撤销                           │
│   · checkAccess(deviceId, user) → bool — 链上实时校验（AI/设备均调用）   │
│                                                                      │
│   合约地址：TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx                       │
│   区块浏览器：https://nile.tronscan.org/#/contract/TBZFyN...          │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流时序（完整闭环）

```
1. 设备启动 → 自动在 TRON 链上注册 DID（设备身份上链）
2. 用户连接钱包 → 一键认领 → 所有权绑定上链
3. 用户对 AI 说"给访客开明天下午的门锁权限"
   → AI 解析意图 → 调用合约 grantAccess（链上签发带 expiry 的授权）
4. 访客 App（模拟另一厂商生态）凭链上授权 P2P 直连门锁
   → checkAccess 通过 → WebRTC DataChannel 直达 → 门锁解锁
5. 到期后链上授权自动失效 → 再次连接被拒
   → 全程无厂商服务器参与数据传输
```

---

## 🎯 已实现成果（可验证）

| 能力 | 状态 | 验证方式 |
|------|:---:|------|
| 智能合约部署 | ✅ | [Tronscan 查看](https://nile.tronscan.org/#/contract/TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx) |
| 设备链上注册 DID | ✅ | 启动门锁 → 链上出现注册交易 |
| 所有权绑定 + 带时间限制授权/撤销 | ✅ | 合约单测覆盖 8 条正确性属性 |
| WebRTC P2P 直连（无中间人数据传输）| ✅ | kill signaling server → 已有连接仍正常工作 |
| AI 自然语言 → Function Calling → P2P 控制 | ✅ | 输入"把门锁上" → 门锁状态实时变化 |
| AI 代理签发链上授权 | ✅ | "给访客开4小时权限" → 链上出现 grantAccess 交易 |
| 持久 P2P 连接池（命令 <50ms） | ✅ | 首次建连后复用 DataChannel |
| 前端演示（钱包连接 + 设备控制 + AI 对话）| ✅ | `npm run web` → 浏览器体验完整流程 |
| 访客视角 + 授权倒计时 + 过期自动失效 | ✅ | 前端角色切换 |
| AI 模块单元测试（37 用例）| ✅ | `cd packages/ai && node --test` |
| 合约单元测试（含时间过期边界）| ✅ | `cd packages/contracts && npm test` |

---

## 🚀 快速启动

### 环境要求

- **Node.js** ≥ 18（推荐 20+）
- **npm** ≥ 8（内置 workspaces）
- **TronLink** 浏览器插件（前端钱包连接）
- TRON Nile 测试币（[水龙头](https://nileex.io/join/getJoinPage)）

### 安装

```bash
git clone https://github.com/your-org/omnilink.git
cd omnilink
npm install
cp .env.example .env
# 编辑 .env 填入你的 TRON_PRIVATE_KEY 和 OPENAI_API_KEY
```

### 一键运行（4 个终端）

```bash
# Terminal 1: WebSocket Signaling Server（信令中转，仅建连时使用）
npm run signaling

# Terminal 2: 虚拟智能门锁（自动上链注册 DID，等待 P2P 连接）
npm run device

# Terminal 3: AI 管家 API（LLM + 链上校验 + P2P 指令）
npm run ai:serve

# Terminal 4: 前端 Demo
npm run web
# → 打开 http://localhost:5173
```

### 快速体验 AI 管家（CLI 模式，无需前端）

```bash
npm run ai
# 试试输入：
#   "解锁实验室门锁"
#   "给访客开明天下午2-4点的权限"
#   "查看所有设备状态"
```

---

## ⚙️ 环境变量

| 变量 | 必填 | 说明 | 默认值 |
|------|:---:|------|--------|
| `TRON_PRIVATE_KEY` | ✅ | TRON 账户私钥（合约部署 + 设备注册） | — |
| `DEVICE_REGISTRY_ADDRESS` | ✅ | DeviceRegistry 合约地址 | `TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx` |
| `OPENAI_API_KEY` | ⚠️ | OpenAI API Key（AI 管家 LLM） | 无则降级为本地规则引擎 |
| `TRON_FULL_NODE` | | TRON 节点 RPC | `https://nile.trongrid.io` |
| `AI_MODE` | | AI 运行模式：`auto`/`openai`/`local` | `auto` |
| `AI_EXECUTOR` | | 指令执行器：`mock`/`p2p` | `mock` |
| `AI_PORT` | | AI API 端口 | `8787` |
| `SIGNALING_PORT` | | Signaling 端口 | `8080` |
| `SIGNALING_URL` | | Signaling WebSocket 地址 | `ws://localhost:8080` |
| `DEVICE_ID` | | 虚拟设备 ID | `omnilink-lock-001` |

---

## 📺 演示流程

> **3-5 分钟完整演示脚本**：[docs/demo-script.md](./docs/demo-script.md)

### 核心主线（门锁场景）

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 设备启动                                                      │
│     虚拟门锁 → 自动在 TRON 链上注册 DID                            │
│                                                                   │
│  2. Owner 认领                                                    │
│     连接 TronLink → 一键 bindOwner → 所有权上链                    │
│                                                                   │
│  3. AI 自然语言控制                                                │
│     "把门锁上" → LLM解析 → checkAccess → P2P直达 → 🔒              │
│                                                                   │
│  4. 跨生态授权                                                    │
│     "给访客开4小时权限" → AI调用grantAccess → 链上签发              │
│     访客App凭链上授权 P2P 直连门锁 → ✅                            │
│                                                                   │
│  5. 到期自动失效                                                   │
│     链上 expiry 到期 → checkAccess=false → 连接被拒 → ❌           │
│     全程无厂商服务器参与                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 去中心化证明（技术亮点）

- **Kill Signaling Server** → 已建立的 P2P 连接仍正常工作（数据从未经过服务器）
- **链上交易可查** → 每一步操作都有对应的链上交易记录
- **WebRTC Internals** → Chrome `chrome://webrtc-internals` 确认真实 P2P 直连

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| **区块链** | TRON (Nile Testnet)、Solidity ^0.8.20、TronWeb v6 |
| **P2P** | WebRTC (simple-peer + @roamhq/wrtc)、WebSocket Signaling |
| **AI** | OpenAI GPT-4 Function Calling、本地规则引擎降级 |
| **前端** | HTML5 SPA、TronLink Wallet Adapter |
| **后端** | Node.js 18+ (ESM)、原生 HTTP Server |
| **合约工具** | solc ^0.8.26、自研轻量编译/部署脚本 |
| **测试** | Node.js 内置 test runner (`node --test`)、Ganache |
| **架构** | npm workspaces monorepo |

---

## 📁 项目结构

```
omnilink/
├── .env.example                 # 环境变量模板
├── package.json                 # Workspace 根配置
├── README.md                    # ← 你正在看的文件
├── OmniLink_立项方案.md          # 完整立项文档
├── OmniLink_一周冲刺计划.md      # 开发节奏规划
├── OmniLink_任务分配.md          # 团队协作分工
│
├── docs/
│   ├── api-contracts.md         # 前后端 API 约定
│   ├── demo-script.md           # 演示视频脚本
│   └── status.md                # 进度追踪
│
└── packages/
    ├── contracts/               # ⛓️ 链上信任层
    │   ├── contracts/
    │   │   └── DeviceRegistry.sol   # 核心合约（DID + 授权）
    │   ├── scripts/
    │   │   ├── compile.js           # 编译
    │   │   └── deploy.js            # 部署到 TRON Nile
    │   ├── build/                   # ABI + Bytecode
    │   ├── deployments/nile.json    # 部署记录
    │   └── test/                    # 合约单测（Ganache + ethers）
    │
    ├── device/                  # 📡 P2P 传输层
    │   └── src/
    │       ├── signaling-server.js  # WebSocket 信令服务（心跳/房间管理）
    │       ├── peer-channel.js      # WebRTC P2P 通道封装
    │       ├── lock.js              # 虚拟智能门锁（链上注册 + P2P 监听）
    │       └── virtual-device.js    # 通用虚拟设备基类
    │
    ├── ai/                      # 🧠 AI 管家层
    │   ├── src/
    │   │   ├── server.js            # HTTP API 服务（6 个端点）
    │   │   ├── cli.js               # CLI 交互模式
    │   │   ├── router.js            # DeviceRouter 适配器
    │   │   ├── tools.js             # Function Calling 工具定义
    │   │   ├── chain-runtime.js     # 链上运行时（读写合约）
    │   │   ├── p2p-persistent.js    # 持久 P2P 连接池
    │   │   ├── local-planner.js     # 本地规则引擎（无 LLM 降级）
    │   │   └── mock-runtime.js      # Mock 运行时（开发用）
    │   └── test/                    # AI 模块单测（37 用例）
    │
    └── web/                     # 💻 用户前端
        └── public/
            └── demo.html            # 完整演示 SPA（单文件，无外部依赖）
```

---

## 🧪 测试

```bash
# 合约单测（Ganache 本地链 + Solidity 编译）
cd packages/contracts && npm test

# AI 模块单测（DeviceRouter + chain-runtime 纯函数）
cd packages/ai && node --test

# P2P 冒烟测试（两进程互发消息）
cd packages/device && node src/p2p-smoke.js
```

---

## 🎯 赛道契合度 (Genesis Track: AI × Web3)

| 评审维度 | OmniLink 的回应 |
|----------|-----------------|
| **AI 与 Web3 的深度融合** | AI Agent **直接管理链上资产**（设备授权），不是浅层集成 |
| **创新性** | 首个将"去中心化设备接入"与"AI 统一控制"结合的方案 |
| **实用性** | 解决真实痛点：跨品牌设备互通、用户控制权归还 |
| **技术完整度** | 四层架构全部可运行，合约已部署，端到端演示闭环 |
| **TRON 生态结合** | 合约部署于 TRON，利用低 Gas + 高 TPS 特性 |
| **可扩展性** | 中继激励经济模型设计（Phase 2）、多设备类型 |

---

## 👥 团队

| 成员 | 职责 |
|------|------|
| **hill son** | P2P 传输层：WebRTC 通道、Signaling Server、设备连接稳定性 |
| **澄you** | 用户端：前端 App、钱包集成、合约前端交互 |
| **good person** | 链上信任层：合约开发部署、设备上链、AI 链上校验支持 |
| **Russssty** | AI 管家层：Function Calling、DeviceRouter、LLM 集成 |

---

## 📄 相关文档

| 文档 | 内容 |
|------|------|
| [立项方案](./OmniLink_立项方案.md) | 完整项目设计、痛点分析、架构详解、竞品对比 |
| [一周冲刺计划](./OmniLink_一周冲刺计划.md) | 7 天开发节奏、每日验收标准、降级方案 |
| [任务分配](./OmniLink_任务分配.md) | 团队分工、依赖关系、交付物清单 |
| [演示脚本](./docs/demo-script.md) | 3-5 分钟演示视频完整脚本 |
| [API 约定](./docs/api-contracts.md) | 前后端接口契约 |

---

## License

[MIT](./LICENSE)

---

<p align="center">
  <strong>🔗 OmniLink</strong> — 去中心化信任 + AI 便利性 = Web3 IoT 新范式
</p>
<p align="center">
  Built with ❤️ for <strong>HTX Genesis Hackathon</strong> · Deployed on <strong>TRON</strong>
</p>
