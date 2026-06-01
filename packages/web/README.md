# @omnilink/web — 用户端

Vite + React 的用户端：连接 TronLink 钱包、读链发现设备、经 P2P 连接并控制设备、AI 自然语言入口。

## 运行

```bash
npm run web
# 打开 http://localhost:5173
```

## 逐日接入计划

| 阶段 | 内容 |
|------|------|
| Day 1 | ✅ 前端骨架 + 钱包连接占位 |
| Day 2 | 接 TronLink、读链上设备列表、调用 `grantAccess` |
| Day 3 | 经 signaling 建立 WebRTC P2P，发送 lock/unlock 指令 |
| Day 4 | 接入 `@omnilink/ai` 自然语言控制 |
| Day 5 | 模拟"第二个生态的访客 App"角色，跑通完整演示主线 |

## 钱包

`src/lib/wallet.js` 封装 TronLink 连接与合约实例获取。合约 ABI 来自
`@omnilink/contracts/build/DeviceRegistry.json`（先运行合约 compile 生成）。
