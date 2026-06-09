/**
 * 生成一个 TRON 测试网钱包地址 + 私钥。
 * 用法: node scripts/gen-wallet.js
 */
import { TronWeb } from "tronweb";

const tronWeb = new TronWeb({ fullHost: "https://nile.trongrid.io" });
const account = await tronWeb.createAccount();

console.log("=== TRON Nile 测试网钱包 ===");
console.log(`地址 (Base58): ${account.address.base58}`);
console.log(`私钥 (Hex):    ${account.privateKey}`);
console.log("");
console.log("下一步:");
console.log(`1. 领测试币: https://nileex.io/join/getJoinPage`);
console.log(`   粘贴地址: ${account.address.base58}`);
console.log(`2. 配置 .env (项目根目录):`);
console.log(`   TRON_PRIVATE_KEY=${account.privateKey}`);
console.log(`   TRON_FULL_NODE=https://nile.trongrid.io`);
console.log(`3. 部署: npm run deploy -w @omnilink/contracts`);
