# @omnilink/device — 虚拟设备 + P2P 传输层

包含演示用虚拟门锁、简易 WebSocket signaling 服务器，以及 WebRTC P2P 通道封装。

## 模块

| 文件 | 说明 |
|------|------|
| `src/signaling-server.js` | 简易 WebSocket signaling（仅转发 SDP/ICE，不碰数据） |
| `src/peer-channel.js` | `simple-peer` + `wrtc` 的 P2P 通道封装，设备端/客户端共用 |
| `src/lock.js` | 虚拟智能门锁：自注册 DID + 等待 P2P 连接 + 执行 lock/unlock |

## 运行

```bash
# 终端 1：启动 signaling 服务器
npm run signaling -w @omnilink/device

# 终端 2：启动虚拟门锁
npm run device -w @omnilink/device
```

## 设计说明

- **signaling 先走简易 WebSocket**：这是一周冲刺计划里明确的"关键妥协"，先保证 P2P 通。链上 signaling 是第 2 周的去中心化升级。
- **数据走 P2P 直连**：指令通过 WebRTC DataChannel 在用户端与门锁之间直接传输，不经业务服务器。
- **降级方案**：若跨网络打洞失败，演示时让设备与用户处于同一局域网即可（故事不变）。

## 已知边界（MVP）

- 当前 DID 注册为本地模拟，第 2 周接通 `DeviceRegistry.registerDevice` 真正上链。
- `@roamhq/wrtc` 为原生模块（`wrtc` 的维护分支），安装较慢；若安装失败可在演示机上改用浏览器端设备模拟。
