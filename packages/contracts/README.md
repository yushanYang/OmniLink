# @omnilink/contracts — 链上信任层

OmniLink 的去中心化核心：设备身份、所有权、授权全部上链，数据传输走 P2P。

## 合约

| 合约 | 状态 | 说明 |
|------|------|------|
| `DeviceRegistry.sol` | ✅ MVP (Day 2) | 设备 DID 注册、所有权绑定、带时间限制的授权/撤销 |
| `RelayIncentive.sol` | 🔜 第 2 周 | 中继节点注册、押金托管、签名回执验证、代币结算 |

### DeviceRegistry 接口

- `registerDevice(deviceId, pubkey, connInfo)` — 设备自注册身份
- `bindOwner(deviceId)` — 用户一键认领所有权
- `grantAccess(deviceId, user, expiry)` — 授权（expiry=0 表示永久）
- `revokeAccess(deviceId, user)` — 撤销授权
- `checkAccess(deviceId, user) view` — 校验访问权（含时间自动失效）
- `getDevice(deviceId) view` — 读取设备信息

## 使用

```bash
# 1. 安装依赖（在仓库根目录）
npm install

# 2. 编译合约
npm run compile -w @omnilink/contracts

# 3. 配置 .env（复制 .env.example），填入测试网私钥

# 4. 部署到 TRON Nile 测试网
npm run deploy -w @omnilink/contracts
```

部署成功后地址会写入 `deployments/nile.json`，请同步填入根目录 `.env` 的 `DEVICE_REGISTRY_ADDRESS`。

## 获取测试币

TRON Nile 测试网水龙头：https://nileex.io/join/getJoinPage
