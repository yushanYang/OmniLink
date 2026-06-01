import { useState } from "react";
import { connectWallet } from "./lib/wallet.js";

/**
 * OmniLink 用户端骨架（冲刺计划 Day 1 前端骨架）。
 * 后续逐日接入：
 *   Day 2 - 连 TronLink、读链上设备列表、grantAccess
 *   Day 3 - 经 signaling 建立 WebRTC P2P，发送 lock/unlock 指令
 *   Day 4 - 接入 AI 管家自然语言控制
 */
export default function App() {
  const [account, setAccount] = useState(null);
  const [devices] = useState([
    { deviceId: "omnilink-lock-001", type: "smart-lock", locked: true, owned: true },
  ]);

  async function onConnect() {
    try {
      const addr = await connectWallet();
      setAccount(addr);
    } catch (err) {
      alert("连接钱包失败: " + err.message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>🔗 OmniLink</h1>
        <p className="tagline">去中心化 IoT 互联与 AI 管家</p>
        {account ? (
          <span className="account">已连接: {account.slice(0, 6)}…{account.slice(-4)}</span>
        ) : (
          <button onClick={onConnect}>连接 TronLink 钱包</button>
        )}
      </header>

      <main>
        <section>
          <h2>我的设备</h2>
          <ul className="device-list">
            {devices.map((d) => (
              <li key={d.deviceId} className="device-card">
                <div className="device-head">
                  <span className="device-name">🔒 {d.deviceId}</span>
                  <span className={d.locked ? "badge locked" : "badge unlocked"}>
                    {d.locked ? "已上锁" : "已解锁"}
                  </span>
                </div>
                <div className="device-actions">
                  <button disabled={!account}>解锁</button>
                  <button disabled={!account}>上锁</button>
                  <button disabled={!account}>授权访客</button>
                </div>
                <p className="hint">P2P 直连 · 链上授权校验（待 Day 3 接通）</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>🧠 AI 管家</h2>
          <div className="ai-box">
            <input placeholder='试试："把门锁上"（待 Day 4 接通）' disabled />
            <button disabled>发送</button>
          </div>
        </section>
      </main>

      <footer>
        <small>HTX Genesis Hackathon · Genesis 赛道 (AI × Web3) · TRON 测试网</small>
      </footer>
    </div>
  );
}
