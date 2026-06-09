# ⛓️ @omnilink/contracts — 链上信任层

OmniLink 的去中心化核心：设备身份（DID）、所有权、访问授权全部上链，数据传输走 P2P。

---

## 📖 目录

- [合约概览](#合约概览)
- [合约地址](#合约地址)
- [接口说明](#接口说明)
- [部署步骤](#部署步骤)
- [ABI 使用](#abi-使用)
- [测试](#测试)
- [获取测试币](#获取测试币)

---

## 合约概览

| 合约 | 状态 | 说明 |
|------|------|------|
| `DeviceRegistry.sol` | ✅ 已部署 | 设备 DID 注册、所有权绑定、带时间限制的授权/撤销 |
| `RelayIncentive.sol` | 🔜 第 2 周 | 中继节点注册、押金托管、签名回执验证、代币结算 |

---

## 合约地址

| 网络 | 地址 | Explorer |
|------|------|----------|
| **TRON Nile 测试网** | `TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx` | [Nile Scan](https://nile.tronscan.org/#/contract/TBZFyNyCBrKq5R6TXhF9rQCLgd2APQcvNx) |
| 本地 Ganache | 见 `deployments/local.json` | — |

部署记录文件：

- `deployments/nile.json` — TRON Nile 测试网部署信息
- `deployments/local.json` — 本地 Ganache 部署信息

---

## 接口说明

### DeviceRegistry

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeviceRegistry {
    // ========== 写入方法 ==========

    /// @notice 设备自注册身份(DID)。任何人可注册，所有者初始为空。
    function registerDevice(
        string calldata deviceId,   // 设备唯一标识
        string calldata pubkey,     // 设备公钥（hex 格式）
        string calldata connInfo    // 连接信息（signaling 房间号）
    ) external;

    /// @notice 用户"一键认领"设备所有权（仅当设备尚未被认领时可用）
    function bindOwner(string calldata deviceId) external;

    /// @notice 所有者授予某用户访问权
    /// @param expiry Unix 时间戳；传 0 表示永久授权
    function grantAccess(
        string calldata deviceId,
        address user,
        uint256 expiry
    ) external;

    /// @notice 所有者撤销某用户访问权
    function revokeAccess(string calldata deviceId, address user) external;

    /// @notice 更新设备连接信息（如 signaling 房间号）
    function updateConnInfo(string calldata deviceId, string calldata connInfo) external;

    // ========== 只读方法 ==========

    /// @notice 校验某用户当前是否有权访问设备（含时间限制自动失效）
    function checkAccess(string calldata deviceId, address user) external view returns (bool);

    /// @notice 读取设备完整信息
    function getDevice(string calldata deviceId) external view returns (
        string memory id,
        string memory pubkey,
        address owner,
        string memory connInfo,
        bool registered
    );

    /// @notice 已注册设备总数
    function deviceCount() external view returns (uint256);

    /// @notice 按索引获取设备 key
    function deviceKeyAt(uint256 index) external view returns (bytes32);
}
```

### 事件

| 事件 | 参数 | 触发时机 |
|------|------|----------|
| `DeviceRegistered` | deviceKey, deviceId, registrant | 设备首次注册 |
| `OwnerBound` | deviceKey, owner | 所有权认领 |
| `AccessGranted` | deviceKey, user, expiry | 授予访问权 |
| `AccessRevoked` | deviceKey, user | 撤销访问权 |
| `ConnInfoUpdated` | deviceKey, connInfo | 更新连接信息 |

---

## 部署步骤

### 1. 安装依赖

```bash
# 在仓库根目录
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

在 `.env` 中填入：

```bash
TRON_PRIVATE_KEY=你的测试网私钥
TRON_FULL_NODE=https://nile.trongrid.io
```

### 3. 编译合约

```bash
npm run compile -w @omnilink/contracts
```

编译产物输出到 `build/DeviceRegistry.json`，包含 ABI 和 bytecode。

### 4. 部署到 TRON Nile 测试网

```bash
npm run deploy -w @omnilink/contracts
```

部署成功后：
- 合约地址写入 `deployments/nile.json`
- 自动回填根目录 `.env` 中的 `DEVICE_REGISTRY_ADDRESS`

### 5. 本地部署（可选，用于联调）

```bash
npm run deploy-local -w @omnilink/contracts
```

本地部署结果写入 `deployments/local.json`，包含本地节点地址与合约地址。

---

## ABI 使用

编译产物路径：`packages/contracts/build/DeviceRegistry.json`

### 在其他包中引用

```js
import abi from "@omnilink/contracts/build/DeviceRegistry.json";

// TronWeb 使用
const contract = await tronWeb.contract(abi.abi, DEVICE_REGISTRY_ADDRESS);

// 查询访问权
const hasAccess = await contract.checkAccess(deviceId, userAddress).call();

// 授权（需要私钥签名）
await contract.grantAccess(deviceId, visitorAddress, expiryTimestamp).send({
  feeLimit: 100_000_000
});
```

---

## 测试

```bash
npm test -w @omnilink/contracts
```

使用 Node.js 内置 test runner (`node --test`)，测试文件位于 `test/` 目录。

---

## 获取测试币

TRON Nile 测试网水龙头：https://nileex.io/join/getJoinPage

---

## 目录结构

```
packages/contracts/
├── contracts/
│   └── DeviceRegistry.sol       # 核心合约源码
├── scripts/
│   ├── compile.js               # Solidity 编译脚本
│   ├── deploy.js                # TRON Nile 部署脚本
│   └── deploy-local.js          # 本地 Ganache 部署
├── build/
│   └── DeviceRegistry.json      # ABI + bytecode（编译产物）
├── deployments/
│   ├── nile.json                # Nile 测试网部署记录
│   └── local.json               # 本地部署记录
├── test/                        # 测试用例
├── package.json
└── README.md                    # 本文件
```
