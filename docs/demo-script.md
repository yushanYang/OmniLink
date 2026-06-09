# 🎬 OmniLink 演示视频脚本

> **时长**：3 分 40 秒 ~ 4 分 30 秒  
> **主线**：智能门锁场景  
> **录制方式**：屏幕录制 + 画外音旁白  
> **分辨率建议**：1920×1080，字体放大确保可读性

---

## 场景一：开场（0:00 – 0:30）

### 【画面】

- 片头动画：OmniLink Logo 渐入，标语 "Decentralized IoT × AI Butler" 浮现
- 切换至一张简洁的对比示意图：
  - 左侧：传统 IoT 链路（设备 → 厂商认证 → 厂商云 → 企业云 → App → 用户），标注 "5 个品牌 = 5 个 App"
  - 右侧：OmniLink（设备 ←链上信任→ 用户，数据走 P2P 直连），标注 "1 个 AI 管家管全屋"

### 【旁白】

> "大家好，这是 OmniLink——去中心化 AI 设备管家。
>
> 今天你家里有 5 个品牌的智能设备，就要装 5 个 App；一旦厂商云服务停运，设备就变砖头。
>
> OmniLink 用区块链做信任背书，WebRTC 做点对点直连，AI 做跨品牌统一控制——
> 让设备真正属于你，让 AI 管家不再被困在某一家的生态孤岛里。
>
> 下面用一个智能门锁的完整场景，3 分钟带你看完全部核心能力。"

### 【操作步骤】

1. 播放预制片头动画（或静态图 + 文字动效）
2. 展示对比图 2-3 秒后切入下一场景

### 【预期效果】

观众在 30 秒内理解：项目是什么、解决什么痛点、为什么需要 Web3 + AI 组合。

---

## 场景二：设备注册与认领（0:30 – 1:15）

### 【画面】

- 左侧终端：虚拟门锁进程启动日志
- 右侧浏览器：OmniLink Web 工作台（`localhost:5173`），设备列表页面
- 底部小窗：TRON Nile 区块浏览器（nile.tronscan.org）显示链上交易

### 【旁白】

> "首先，设备上线。我们启动一台虚拟门锁——它会自动在 TRON 链上注册一个去中心化身份，也就是 DID。
>
> 注意看终端日志：门锁生成了自己的密钥对，调用 DeviceRegistry 合约的 `registerDevice` 方法，把 DID 写入链上。
>
> 在 Nile 区块浏览器里可以看到这笔交易已经确认。
>
> 现在切到用户端。我连接 TronLink 钱包，在设备列表里看到这台 "未认领" 的门锁。点击 "认领" 按钮——钱包弹窗签名确认——所有权绑定上链。
>
> 从此，这台门锁的控制权就锚定在我的链上地址，不经过任何厂商服务器。"

### 【操作步骤】

1. 终端执行 `npm run device`，观察日志输出：
   - `[Device] Generating keypair...`
   - `[Device] Calling registerDevice() on Nile...`
   - `[Device] Registered! DID: did:tron:T...xxx`
   - `[Device] Connecting to signaling server...`
   - `[Device] Status: online, waiting for owner`
2. 浏览器打开 OmniLink Web → 连接 TronLink 钱包
3. 设备列表显示 `Lab Door Lock` — 状态 `online` / access `pending`
4. 点击 "Claim（认领）" 按钮 → TronLink 弹窗 → 签名确认
5. 设备卡片状态刷新为 `access: granted` / `owner: TP5x...`
6. 切到 Nile Tronscan 展示 `claimDevice` 交易记录

### 【预期效果】

- 终端日志清晰展示设备自注册过程
- 链上交易可验证（txId 可查）
- 用户端实时感知设备上链状态变化

---

## 场景三：AI 自然语言控制（1:15 – 2:15）

### 【画面】

- 浏览器主区域：OmniLink AI Agent 聊天界面
- 右侧面板：设备状态卡片（门锁图标 + 状态标识）
- 左下小窗：终端显示 P2P 通道日志

### 【旁白】

> "设备认领完成，接下来展示 AI 控制。
>
> 我在 AI 管家对话框输入：'把门锁上'。
>
> 看幕后发生了什么——AI 收到自然语言后，通过 LLM Function Calling 将它解析为一条标准化设备指令：`sendDeviceCommand({ deviceId: 'lock-lab-001', action: 'lock' })`。
>
> 注意，这条指令不经过任何厂商服务器——它走的是 WebRTC P2P 数据通道，直接发到门锁设备。
>
> 门锁收到指令，执行上锁，状态从 unlocked 变为 locked。全程延迟不到 200 毫秒。
>
> 再试一条复合指令：'帮我解锁门锁，然后 30 秒后自动锁上'——AI 解析出两条指令并排队执行。这就是跨品牌统一控制通道的威力。"

### 【操作步骤】

1. 在 AI 聊天输入框键入：`把门锁上`
2. 等待 AI 回复，界面展示：
   - AI 文字回复："好的，正在锁定门锁。"
   - Function Call 可视化面板高亮显示：
     ```json
     {
       "name": "sendDeviceCommand",
       "arguments": { "deviceId": "lock-lab-001", "action": "lock" }
     }
     ```
3. 设备状态卡片从 🟢 Unlocked 切换为 🔴 Locked（带动画过渡）
4. 终端日志显示：
   - `[P2P] Command received via DataChannel: lock`
   - `[Device] Executing: lock → success`
5. （可选）输入第二条指令：`帮我解锁门锁`，展示 unlock 流程

### 【预期效果】

- 自然语言到设备动作全链路可视化
- Function Calling JSON 结构直观展示
- P2P 通道日志证明"数据不过服务器"
- 设备状态实时同步

---

## 场景四：跨生态授权（2:15 – 3:15）

### 【画面】

- 左半屏：Owner（房主）的 OmniLink Web 工作台
- 右半屏：Guest（访客/保洁阿姨）的另一浏览器窗口（模拟另一厂商生态的客户端）
- 底部状态栏：倒计时 / 授权有效期

### 【旁白】

> "核心场景来了——跨生态授权。
>
> 我作为房主，对 AI 管家说：'给保洁阿姨的钱包地址 TMock...开一个 2 小时的门锁临时权限'。
>
> AI 理解后，调用链上合约的 `grantAccess` 方法，为指定地址签发一个带时间限制的授权 Token。这笔交易上链确认。
>
> 现在切到访客视角——阿姨使用的是一个完全不同的客户端。她连接自己的钱包，系统读链发现她对这台门锁有临时授权。
>
> 她点击 '连接设备'——注意，这里建立的是 WebRTC P2P 直连，不经过房主的账号、不经过任何厂商中转服务器。
>
> 访客直接对门锁发出 unlock 指令——成功开锁。
>
> 2 小时后，链上授权自动过期。访客再次尝试连接——合约校验失败，设备拒绝握手。
> 全程无需房主手动撤销，也无需任何中心化后台参与。"

### 【操作步骤】

1. Owner 端 AI 输入：`给地址 TMock8JbQWj5rG9A4Demo 开 2 小时的门锁权限`
2. AI 回复确认 + Function Call 展示：
   ```json
   {
     "name": "grantDeviceAccess",
     "arguments": {
       "deviceId": "lock-lab-001",
       "guestAddress": "TMock8JbQWj5rG9A4Demo",
       "durationHours": 2
     }
   }
   ```
3. TronLink 签名确认 → 链上交易成功（展示 txId）
4. 切换至 Guest 浏览器窗口：
   - 连接不同的钱包地址 `TMock8JbQWj5rG9A4Demo`
   - 设备列表出现门锁，状态 `access: granted` / `expiresAt: 2h后`
5. Guest 点击 "Connect P2P" → WebRTC 握手成功
6. Guest 发送 unlock 指令 → 门锁解锁成功
7. （演示加速）模拟时间到期：
   - 刷新页面 → 设备状态变为 `access: expired`
   - 再次尝试连接 → 界面提示 "Authorization expired on-chain"
   - 终端日志：`[Device] Access check failed: expired`

### 【预期效果】

- 清晰展示"跨生态"概念：两个不同客户端，凭链上授权互通
- 时间限制授权的完整生命周期（授予 → 使用 → 到期失效）
- P2P 直连不经过房主或厂商

---

## 场景五：技术亮点展示（3:15 – 3:45）

### 【画面】

- 三格分屏展示：
  1. TRON 区块浏览器：链上交易列表（registerDevice / claimDevice / grantAccess）
  2. 浏览器 DevTools → WebRTC Internals（`chrome://webrtc-internals`）：显示 P2P DataChannel 活跃
  3. 终端：手动 kill signaling 服务器进程，P2P 连接依然存活

### 【旁白】

> "最后快速总结三个技术亮点：
>
> 第一，链上可验证——刚才所有操作：注册、认领、授权，每一笔交易都可以在 TRON 区块浏览器上独立验证。没有黑箱。
>
> 第二，P2P 无中间人——打开 Chrome 的 WebRTC 内部页面，可以看到数据通道直连设备，没有经过我们的业务服务器。用户数据从不被第三方看到。
>
> 第三，Signaling 挂了连接仍存活——我现在手动 kill 掉 signaling 服务器……注意看，已有的 P2P 连接完全不受影响。设备依然可以控制。这就是去中心化架构的韧性。"

### 【操作步骤】

1. 展示 Nile Tronscan 合约交易列表（3-4 笔可见）
2. 打开 `chrome://webrtc-internals`，高亮 DataChannel stats
3. 终端执行 `kill <signaling-pid>` 或 Ctrl+C signaling 进程
4. 回到浏览器，再次发送 lock/unlock 指令 → 依然成功
5. 终端日志确认：`[P2P] Channel still active, no signaling needed`

### 【预期效果】

- 技术可信度拉满：链上可查 + DevTools 可见 + 容灾可演
- 评委对"去中心化不是嘴上说说"留下深刻印象

---

## 场景六：总结（3:45 – 4:00）

### 【画面】

- 全屏总结卡片（深色背景 + 亮色文字）：
  ```
  ⛓️  链上信任：设备身份 · 所有权 · 授权可验证
  📡  P2P 直连：数据不过服务器 · 隐私零暴露
  🧠  AI 管家：自然语言 · 跨品牌 · 统一控制
  
  去中心化信任 + AI 便利性 = Web3 IoT 新范式
  ```
- 底部：项目 GitHub 地址 / TRON Nile 合约地址 / 团队信息

### 【旁白】

> "OmniLink 证明了一件事：
> 当设备的信任层去中心化之后，AI 第一次获得了跨厂商、统一授权的设备控制身体。
>
> 去中心化信任，加上 AI 的便利性，等于 Web3 IoT 的新范式。
>
> 感谢观看。代码已开源，合约已部署在 TRON Nile 测试网，欢迎验证。"

### 【操作步骤】

1. 展示总结页 3 秒
2. 淡出至 Logo + 联系方式

### 【预期效果】

- 一句话提炼价值主张，便于评委记忆和转述
- 留下可验证信息（合约地址、GitHub）

---

## 附录：录制准备清单

### 环境准备

| 项目 | 检查点 |
|------|--------|
| Node.js 环境 | `npm install` 全部通过 |
| TRON Nile 测试币 | 账户余额充足（≥1000 TRX） |
| TronLink 钱包 | 安装且切换到 Nile 测试网 |
| 合约已部署 | `npm run contracts:deploy` 成功 |
| Signaling 服务 | `npm run signaling` 正常运行 |
| 虚拟设备 | `npm run device` 正常运行并注册 |
| AI 服务 | `npm run ai` 正常（LLM API Key 有效） |
| Web 前端 | `npm run web` → `localhost:5173` 可访问 |
| 第二浏览器窗口 | 访客钱包地址准备好 |

### 录制工具建议

- 屏幕录制：OBS Studio（支持多源分屏）
- 终端美化：iTerm2 + 增大字号至 16pt
- 浏览器：Chrome，关闭不必要扩展
- 旁白：后期配音或同步录制均可

### 时间分配（精确版）

| 场景 | 时间段 | 时长 | 核心展示 |
|------|--------|------|----------|
| 开场 | 0:00-0:30 | 30s | 痛点 + 定位 |
| 设备注册与认领 | 0:30-1:15 | 45s | 链上 DID + 所有权绑定 |
| AI 自然语言控制 | 1:15-2:15 | 60s | Function Calling + P2P 下发 |
| 跨生态授权 | 2:15-3:15 | 60s | 时间限授权 + 访客直连 |
| 技术亮点 | 3:15-3:45 | 30s | 三项验证 |
| 总结 | 3:45-4:00 | 15s | 价值主张 |

### 应急预案

| 风险 | 预案 |
|------|------|
| 链上交易超时 | 提前录好合约交互片段，剪辑拼接 |
| P2P 连接失败 | 确保同一局域网演示；备用 coturn 中继 |
| LLM 响应慢 | AI 接口加 mock fallback，保证演示流畅 |
| TronLink 弹窗遮挡 | 提前设置好窗口位置，避免遮挡关键区域 |

---

> _本脚本为 HTX Genesis 黑客松提交物之一，配合 Demo 视频录制使用。_
