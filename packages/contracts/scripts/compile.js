/**
 * 编译 contracts/ 下的 Solidity 合约，输出 ABI 与 bytecode 到 build/。
 * 用法: npm run compile -w @omnilink/contracts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contractsDir = path.join(root, "contracts");
const buildDir = path.join(root, "build");

function loadSources() {
  const sources = {};
  for (const file of fs.readdirSync(contractsDir)) {
    if (file.endsWith(".sol")) {
      sources[file] = { content: fs.readFileSync(path.join(contractsDir, file), "utf8") };
    }
  }
  return sources;
}

function main() {
  const input = {
    language: "Solidity",
    sources: loadSources(),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "istanbul",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    for (const err of output.errors) {
      console.error(err.formattedMessage);
      if (err.severity === "error") hasError = true;
    }
    if (hasError) process.exit(1);
  }

  fs.mkdirSync(buildDir, { recursive: true });
  for (const [file, contracts] of Object.entries(output.contracts)) {
    for (const [name, artifact] of Object.entries(contracts)) {
      const out = {
        contractName: name,
        abi: artifact.abi,
        bytecode: artifact.evm.bytecode.object,
      };
      const outPath = path.join(buildDir, `${name}.json`);
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
      console.log(`✓ compiled ${name} (${file}) -> build/${name}.json`);
    }
  }
}

main();
