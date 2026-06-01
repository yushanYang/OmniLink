# 👥 OmniLink 开发任务分配文档

> 本文档基于现有四层架构（`packages/contracts` / `packages/device` / `packages/ai` / `packages/web`）与一周冲刺计划，结合四名成员的意向方向进行任务拆分。
>
> 配套文档：[`OmniLink_立项方案.md`](./OmniLink_立项方案.md)（立项）、[`OmniLink_一周冲刺计划.md`](./OmniLink_一周冲刺计划.md)（节奏）、[`.kiro/specs/omnilink-platform/design.md`](./.kiro/specs/omnilink-platform/design.md)（技术设计）。
>
> **分配原则**：① 一人一条主线、避免同文件高频冲突；② 每人意向方向优先；③ 联调任务明确"双人 owner"，责任不悬空。

---

## 1. 成员与模块总览

| 成员 | 意向方向 | 主责模块 | 协作模块 |
|------|---------|---------|---------|
| **hill son** | 设备层的通信连接 | 📡 P2P 传输层 `packages/device` | 与前端/AI 联调 P2P |
| **澄you** | App 开发 / 前端，可做合约 | 💻 用户端 `packages/web` | ⛓️ `packages/contracts`（前端读写合约） |
| **good person** | AI / 区块链 / 硬件 | ⛓️ 链上信任层 `packages/contracts` | 🧠 `packages/ai`（链上校验接入）、设备上链 |
| **Russssty** | AI Agent / 前端 / App | 🧠 AI 管家层 `packages/ai` | 💻 `packages/web`（AI 入口） |

### 1.1 模块归属与当前缺口速览

| 模块 | 主责 | 现状 | 本周关键缺口 |
|------|------|------|-------------|
| `packages/contracts` | good person | 合约已编译，**未部署** | 部署 Nile、回填地址、补单测 |
| `packages/device` | hill son | 三模块骨架可跑、冒烟脚本在 | `lock.js` 上链注册仍是 TODO、P2P 联调未做 |
| `packages/ai` | Russssty | Function Calling 闭环 + mock 可跑 | `checkAccess` 前置校验 TODO、真实 P2P executor 未接 |
| `packages/web` | 澄you | 静态骨架、数据写死、按钮 disabled | 连合约 / 读链发现 / 授权 / P2P 控制全未接 |

> 说明：现状基于对当前代码的核对。`packages/contracts/deployments/` 不存在，`lock.js` 与 `router.js` 中均存在明确的 `TODO` 占位。

---

## 2. 各成员任务拆分

### 2.1 hill son — 设备层与通信连接（`packages/device`）

> 主线：让虚拟门锁"上链注册 → 被 P2P 连上 → 执行指令并回传"整条通信链路稳定可用。这是演示主线里最依赖真机真网络调试的部分，时间要留足。

| # | 任务 | 涉及文件 | 验收标准 | 对应 Day |
|---|------|---------|---------|:---:|
| D1 | signaling 服务器稳定性加固：断连清理、房间日志、异常不崩 | `src/signaling-server.js` | 多 peer 反复进出房间不报错、不泄漏 | Day 1-2 |
| D2 | 门锁真正上链注册：用 TronWeb 调 `registerDevice(deviceId, pubkey, connInfo)`，替换当前本地公钥占位 | `src/lock.js` | 启动门锁后区块浏览器能查到注册交易 | Day 2-3 |
| D3 | P2P 指令处理完善：`lock`/`unlock`/`status` 状态机 + `result` 回执（含 `requestId`） | `src/lock.js`、`src/peer-channel.js` | 对端发 command，门锁状态改变并原样回传 requestId | Day 3 |
| D4 | 提供"客户端侧 peer-channel 使用范例"，供前端/AI 复用同一套握手 | `src/peer-channel.js`（导出契约不变） | 前端能 import 同一封装连上门锁 | Day 3 |
| D5 | 连接健壮性：ws 断线重连、打洞失败降级到同局域网、连接状态回调 | `src/peer-channel.js`、`src/lock.js` | 拔网/重启 signaling 后能恢复或有明确提示 | Day 6 |

**依赖**：D2 依赖 good person 部署合约并提供地址 + ABI 路径。
**交付物**：门锁可上链、可被连、可控制；一份"如何连门锁"的简短说明（写到 `packages/device/README.md`）。

---

### 2.2 good person — 链上信任层（`packages/contracts`，含 AI/硬件协作）

> 主线：把合约从"已编译"推到"已部署可用"，并成为其他三人联调的链上地基。意向覆盖 AI 与硬件，因此额外承接"设备上链"与"AI 链上校验"的协作支持。

| # | 任务 | 涉及文件 | 验收标准 | 对应 Day |
|---|------|---------|---------|:---:|
| C1 | 部署 `DeviceRegistry` 到 TRON Nile，回填 `deployments/nile.json` 与 `.env` 地址 | `scripts/deploy.js`、`.env` | 拿到链上合约地址，区块浏览器可查 | Day 1-2 |
| C2 | 导出前端可用的 ABI 引用路径，约定 `build/DeviceRegistry.json` 的消费方式 | `build/DeviceRegistry.json` | 前端/设备/AI 三方都能拿到同一份 ABI | Day 2 |
| C3 | 合约单元测试：注册/重复注册、认领/重复认领、授权/撤销、**时间限过期边界** | 新增 `test/*.test.js`（`node --test`） | `npm test -w @omnilink/contracts` 全绿，覆盖 8 条正确性属性 | Day 2-4 |
| C4 | 协助 hill son（设备上链）：为 `registerDevice` 调用核对参数与 gas 配置 | 配合 `device/src/lock.js` | 门锁注册交易成功上链 | Day 3 |
| C5 | 协助 Russssty：提供 `checkAccess` 链上读法范例，接入 AI executor 前置校验 | 配合 `ai/src/router.js` | AI 下发前能正确读到 true/false | Day 4 |
| C6 | 整理合约部署说明写入 README（地址、部署步骤、网络） | `README.md`、`packages/contracts/README.md` | 提交物"合约地址 + 部署记录"齐全 | Day 7 |

**风险点**：测试币领取与部署可能卡网络，C1 务必 Day 1 先跑通一次部署 demo（冲刺计划 Day 1 已要求）。
**交付物**：链上合约地址、`deployments/nile.json`、合约单测、部署文档。

---

### 2.3 澄you — 用户端 / App 开发（`packages/web`，含合约前端交互）

> 主线：把当前静态骨架升级为"连钱包 → 读链发现设备 → 认领/授权 → P2P 控制"的可用界面。意向可做合约，因此前端读写合约这块由你独立承接，无需等 good person 包接口。

| # | 任务 | 涉及文件 | 验收标准 | 对应 Day |
|---|------|---------|---------|:---:|
| W1 | TronLink 连接完善 + 账户状态展示（已有 `wallet.js` 基础） | `src/lib/wallet.js`、`src/App.jsx` | 连上钱包显示地址，断开/切换有反馈 | Day 2 |
| W2 | 读链发现设备：用 ABI + `deviceCount`/`deviceKeyAt`/`getDevice` 渲染真实设备列表，替换写死 mock | `src/App.jsx`、新增 `src/lib/registry.js` | 列表来自链上而非硬编码 | Day 2-3 |
| W3 | 设备操作上链：`bindOwner` 认领、`grantAccess`（带 expiry 时间选择）、`revokeAccess` | `src/lib/registry.js`、`src/App.jsx` | 点按钮发起交易，区块浏览器可查 | Day 2-3 |
| W4 | P2P 控制接入：复用 hill son 的 `peer-channel`（浏览器端 simple-peer），发 `lock`/`unlock`，实时显示状态 | `src/App.jsx`、`src/lib/peer.js` | 页面按钮能真实解锁/上锁门锁 | Day 3 |
| W5 | AI 管家入口：接 Russssty 的 chat 接口，输入框启用，展示对话与执行结果 | `src/App.jsx` | "把门锁上"经 AI 链路生效并回显 | Day 4 |
| W6 | 访客视角：模拟"另一生态访客 App"（另一账号/角色），凭链上授权直连门锁 | `src/App.jsx` | 演示主线第 4 步可走通 | Day 5 |
| W7 | 演示态打磨：关键状态直观（授权倒计时、连接状态、链上交易链接） | `src/styles.css`、`src/App.jsx` | 评委一眼能看懂当前状态 | Day 6 |

**依赖**：W2/W3 依赖 good person 的合约地址与 ABI（C1/C2）；W4 依赖 hill son 的门锁可连（D3/D4）；W5 依赖 Russssty 的 chat 接口（A3）。
**注意**：浏览器端 WebRTC 用浏览器原生实现，不需要 `@roamhq/wrtc`，与 Node 端 peer-channel 共用协议但实例化方式不同，需与 hill son 对齐握手细节。
**交付物**：可连钱包、读链、授权、P2P 控制、含 AI 入口的用户端。

---

### 2.4 Russssty — AI Agent（`packages/ai`，含前端 AI 入口）

> 主线：把 AI 从"mock 闭环"升级为"真实下发 + 链上授权前置"，并与澄you 对接前端 AI 入口。意向覆盖 AI/前端/App，与 W5 天然协作。

| # | 任务 | 涉及文件 | 验收标准 | 对应 Day |
|---|------|---------|---------|:---:|
| A1 | Function Calling 闭环验证（已可跑）：补充 `set_brightness`/`set_temperature` 等多动作样例 | `src/tools.js`、`src/cli.js` | CLI 多类指令都能正确解析路由 | Day 1-2 |
| A2 | 链上授权前置：在 `control_device` 执行前调用 `checkAccess`，无权返回 `unauthorized`（落实 router.js 的 TODO） | `src/router.js` | 无授权设备指令被 AI 如实拒绝 | Day 4 |
| A3 | 真实 P2P executor：把 mock executor 换成基于 `peer-channel` 的真实下发，并等待 `result` | `src/router.js`、新增 `src/executor.js` | AI 指令经 P2P 真正到达门锁 | Day 4 |
| A4 | 暴露给前端的 chat 接口/封装，供澄you 的 W5 调用 | `src/index.js` | 前端能 import 或经轻量服务调用 chat | Day 4 |
| A5 | 多设备一句话控制（有余力）：一句指令路由到多设备 | `src/router.js`、`src/tools.js` | "全屋关灯锁门"能拆成多指令 | Day 5 |
| A6 | AI 路由单测：注入 mock executor 测 `handleToolCall` 各分支 | 新增 `test/*.test.js` | `npm test -w @omnilink/ai` 全绿 | Day 5-6 |

**依赖**：A2 依赖 good person 的 `checkAccess` 读法（C5）；A3 依赖 hill son 的门锁可连（D3/D4）；A4 与澄you 的 W5 对接。
**交付物**：AI 真实下发 + 链上校验 + 前端可调用接口 + 路由单测。

---

## 3. 联调任务与双人 Owner

跨模块的联调最容易"责任悬空"，这里明确每个联调点的双 owner。

| 联调点 | 主 owner | 副 owner | 内容 | Day |
|--------|---------|---------|------|:---:|
| 设备上链注册 | hill son | good person | `lock.js` 调通 `registerDevice` | Day 3 |
| 前端读链 + 授权 | 澄you | good person | web 经 ABI 读设备、发 `grantAccess` | Day 2-3 |
| 前端 ↔ 门锁 P2P | 澄you | hill son | 浏览器 simple-peer 连上 Node 门锁 | Day 3 |
| AI 链上校验 | Russssty | good person | `control_device` 前置 `checkAccess` | Day 4 |
| AI 真实下发 | Russssty | hill son | executor 经 P2P 到门锁并回执 | Day 4 |
| 前端 AI 入口 | 澄you | Russssty | web 输入框接 chat 接口 | Day 4 |
| 演示主线串联 | 全员 | — | 注册→认领→授权→访客直连→到期失效 | Day 5 |

---

## 4. 按 Day 的并行节奏

| Day | hill son（设备） | good person（合约） | 澄you（前端） | Russssty（AI） |
|:---:|---|---|---|---|
| 1 | P2P 冒烟 + signaling 加固 | 部署 demo 跑通、领测试币 | 钱包连接打通 | LLM Function Calling 跑通 |
| 2 | 门锁上链注册 | **部署合约**、回填地址、起单测 | 读链设备列表 | 多动作指令样例 |
| 3 | P2P 指令处理 + 客户端范例 | 协助设备上链、补单测 | 授权 + P2P 控制接入 | （待 P2P 就绪） |
| 4 | 配合 AI 下发联调 | 协助 AI 链上校验 | AI 入口接入 | 链上校验 + 真实下发 + chat 接口 |
| 5 | 配合主线 + 局域网兜底 | 主线链上环节核对 | 访客视角 + 主线串联 | 多设备控制（有余力） |
| 6 | 连接健壮性加固 | 部署文档 | 演示态打磨 | 路由单测 |
| 7 | 主线陪跑 | 合约地址/README 整理 | Demo 录制配合 | 提交物自查 |

---

## 5. 完成定义（DoD · 对齐冲刺计划自检）

- [ ] 虚拟门锁能上链注册（测试网可查交易）— hill son + good person
- [ ] 用户端能读链发现设备并校验授权 — 澄you + good person
- [ ] WebRTC P2P 能连上设备并控制（至少局域网）— 澄you + hill son
- [ ] AI 能用自然语言控制设备（至少单设备）— Russssty + hill son
- [ ] AI 下发前经链上 `checkAccess` 授权校验 — Russssty + good person
- [ ] 门锁演示主线能连续跑通 3 次不崩 — 全员
- [ ] Demo 视频 + 开源仓库 + README + 合约地址就绪 — 全员

---

## 6. 协作约定

- **分支**：每人按模块开分支（如 `feat/device-onchain`、`feat/web-registry`），联调任务用临时联调分支，避免直接推 main。
- **接口先行**：联调点先约定接口契约（函数签名/消息格式）再各自实现，参考 design.md §12「模块间契约小结」。
- **30 分钟原则**：任一技术点卡超 30 分钟立即切降级方案（见冲刺计划 §3），不死磕。
- **每日同步**：每天收尾按"按 Day 节奏"表对一次进度，阻塞项当天暴露。

> _本任务分配为冲刺执行配套文档，随联调推进可调整 owner 与优先级。_
