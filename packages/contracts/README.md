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

### 本地联调部署

如果你想先在本地进行联调，可以直接部署到本地 Ganache：

```bash
npm run deploy-local -w @omnilink/contracts
```

本地部署结果会写入 `packages/contracts/deployments/local.json`，其中包含本地节点地址与合约地址。

部署成功后地址会写入 `deployments/nile.json`，如果项目根目录存在 `.env` 文件，部署脚本会自动回填 `DEVICE_REGISTRY_ADDRESS`。

## 前端 / AI / 设备层使用示例

前端、AI、设备层统一引用 `packages/contracts/build/DeviceRegistry.json` 的 ABI。

```js
import abi from "@omnilink/contracts/build/DeviceRegistry.json";

const contract = await tronWeb.contract(abi.abi, DEVICE_REGISTRY_ADDRESS);
const hasAccess = await contract.checkAccess(deviceId, userAddress).call();
```

如果你想在 AI /控制层做链上授权校验：

```js
const allowed = await registry.checkAccess(deviceId, userAddress).call();
if (!allowed) {
  return { ok: false, error: "unauthorized" };
}
```

## 测试

```bash
npm test -w @omnilink/contracts
```

## 获取测试币

TRON Nile 测试网水龙头：https://nileex.io/join/getJoinPage
