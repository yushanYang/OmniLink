# 🔗 OmniLink — 去中心化 IoT 互联与 AI 管家

> 让物联网设备摆脱厂商平台的层层认证，通过区块链直接与用户点对点（P2P）连接，并在此之上构建一个能管理全屋跨品牌设备的 AI 管家。
>
> **参赛**：HTX Genesis 创世纪黑客松 · Genesis 赛道（AI × Web3） · 部署于 TRON

📄 立项方案见 [`OmniLink_立项方案.md`](./OmniLink_立项方案.md)，执行计划见 [`OmniLink_一周冲刺计划.md`](./OmniLink_一周冲刺计划.md)。

## 架构（三层）

```
🧠 AI 管家层    自然语言 → Function Calling → 跨品牌设备统一控制   (packages/ai)
📡 P2P 传输层   WebRTC 直连，数据不过业务服务器                  (packages/device)
⛓️ 链上信任层   设备身份 DID + 所有权 + 授权/撤销 (TRON)          (packages/contracts)
```

## 仓库结构（npm workspaces 单仓多包）

| 包 | 角色 | 职责 |
|----|------|------|
| `packages/contracts` | ⛓️ 合约/Web3 | `DeviceRegistry`：DID 注册、所有权、带时间限制的授权 |
| `packages/device` | 🔧 后端/设备 | 虚拟门锁、WebSocket signaling、WebRTC P2P 通道 |
| `packages/ai` | 🧠 AI | 自然语言 → 指令路由（LLM Function Calling） |
| `packages/web` | 💻 前端 | 连钱包、读链发现设备、P2P 控制、AI 入口 |

## 快速开始

```bash
# 1. 安装全部依赖（workspace 根目录）
npm install

# 2. 准备环境变量
cp .env.example .env   # 填入测试网私钥 / LLM key

# 3. 编译并部署合约（TRON Nile 测试网）
npm run compile -w @omnilink/contracts
npm run contracts:deploy

# 4. 启动各模块（分终端）
npm run signaling   # 终端1: signaling 服务器
npm run device      # 终端2: 虚拟门锁
npm run ai          # 终端3: AI 管家 CLI demo
npm run web         # 终端4: 用户端 http://localhost:5173
```

## 演示主线（门锁场景）

1. 虚拟门锁启动 → 自动在 TRON 链上注册 DID
2. 用户用钱包"一键认领"门锁 → 所有权绑定上链
3. 用户对 AI 说"给保洁阿姨开明天下午 2–4 点的门锁权限" → AI 在链上签发带时间限制的授权
4. 访客 App（模拟另一厂商生态）凭链上授权 P2P 直连门锁
5. 到点后授权在链上自动失效，全程无厂商服务器参与

## 当前进度（一周冲刺）

- [x] 仓库脚手架与四个工作区
- [x] `DeviceRegistry` 合约（注册/绑定/授权/撤销/时间限制）
- [x] signaling 服务器 + P2P 通道封装 + 虚拟门锁骨架
- [x] AI 管家 Function Calling 骨架（mock 设备可跑）
- [x] 用户端骨架（钱包连接）
- [ ] 链 + P2P + 授权联调（Day 3）
- [ ] AI 真实下发指令 + 时间限授权（Day 4）
- [ ] 演示主线串联与加固（Day 5-6）

## 明确不做（避免范围膨胀）

真实硬件固件对接、自研 TURN/转发、中继防作弊密码学验证（zk/TEE）、复杂多轮记忆。详见立项方案 §8.3。

## 提交物清单

- [ ] 开源仓库 + README + 部署说明
- [ ] Demo 视频（门锁主线 3–5 分钟）
- [ ] 项目文档
- [ ] HTX 生态资源证明（TRON 合约地址 + 激励模型）
- [ ] 测试网合约部署记录

## 前端工作台

`packages/web` 已提供可演示的前端工作台，包含钱包连接、设备列表、授权检查、P2P 控制、AI Agent UI、联调控制台、一键 Demo Flow 和中英文切换。

```bash
npm install
npm run dev:web
```

默认使用 mock 模式；如需接真实服务，在 `packages/web/.env.local` 配置：

```bash
VITE_OMNILINK_REGISTRY_API=http://127.0.0.1:7001
VITE_OMNILINK_PEER_API=http://127.0.0.1:7002
VITE_OMNILINK_AI_API=http://127.0.0.1:7003
```

接口与后端实现文档：

- `docs/api-contracts.md`
- `docs/backend-api-implementation.md`
- `packages/web/.env.example`

项目本地开发规则见 `.project-skills.md`。
