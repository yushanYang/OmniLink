/**
 * 部署 DeviceRegistry 到 TRON 测试网 (Nile)。
 * 前置: 已运行 compile，且 .env 配置了 TRON_PRIVATE_KEY。
 * 用法: npm run deploy -w @omnilink/contracts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { TronWeb } from "tronweb";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function main() {
  const privateKey = process.env.TRON_PRIVATE_KEY;
  if (!privateKey || privateKey === "your_test_net_private_key_here") {
    console.error("✗ 请在 .env 设置 TRON_PRIVATE_KEY（测试网私钥）。");
    process.exit(1);
  }

  const fullNode = process.env.TRON_FULL_NODE || "https://nile.trongrid.io";
  const tronWeb = new TronWeb({
    fullHost: fullNode,
    privateKey,
  });

  const artifactPath = path.join(root, "build", "DeviceRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("✗ 未找到 build/DeviceRegistry.json，请先运行: npm run compile -w @omnilink/contracts");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("部署 DeviceRegistry 到", fullNode, "...");
  const contract = await tronWeb.contract().new({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    feeLimit: 1_000_000_000,
    callValue: 0,
  });

  const address = tronWeb.address.fromHex(contract.address);
  console.log("✓ 部署成功! DeviceRegistry 地址:", address);

  // 回写部署记录
  const deploymentsDir = path.join(root, "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "nile.json"),
    JSON.stringify({ DeviceRegistry: address, network: fullNode, deployedAt: new Date().toISOString() }, null, 2)
  );
  console.log("→ 已写入 deployments/nile.json");
  console.log("→ 请把该地址填入 .env 的 DEVICE_REGISTRY_ADDRESS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
