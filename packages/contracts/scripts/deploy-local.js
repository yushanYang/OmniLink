import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import Ganache from "ganache";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contractsDir = path.join(root, "contracts");
const buildDir = path.join(root, "build");
const deploymentsDir = path.join(root, "deployments");
const contractFile = "DeviceRegistry.sol";
const contractName = "DeviceRegistry";
const localPort = 8545;

function compileContract() {
  const sources = {
    [contractFile]: {
      content: fs.readFileSync(path.join(contractsDir, contractFile), "utf8"),
    },
  };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "istanbul",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errors = output.errors.filter((err) => err.severity === "error");
    if (errors.length) {
      throw new Error(errors.map((err) => err.formattedMessage).join("\n"));
    }
  }

  const artifact = output.contracts[contractFile][contractName];
  if (!artifact) throw new Error(`Failed to compile ${contractName}`);

  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(
    path.join(buildDir, `${contractName}.json`),
    JSON.stringify({ contractName, abi: artifact.abi, bytecode: artifact.evm.bytecode.object }, null, 2),
    "utf8"
  );

  return { abi: artifact.abi, bytecode: artifact.evm.bytecode.object };
}

async function main() {
  console.log("Compiling DeviceRegistry for local deployment...");
  const artifact = compileContract();

  const privateKey = "0xda13b6f3fcf96a29ae5f4104f3a89c28da30098d639fc7eeb08644eb1f25a2a1";
  const server = Ganache.server({
    wallet: {
      accounts: [{ secretKey: privateKey, balance: "0x1000000000000000000" }],
    },
    logging: { quiet: true },
  });

  await server.listen(localPort);
  const provider = new JsonRpcProvider(`http://127.0.0.1:${localPort}`);
  const signer = new Wallet(privateKey, provider);

  console.log(`Local Ganache running at http://127.0.0.1:${localPort}`);
  console.log(`Deploying DeviceRegistry from ${signer.address}...`);

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log(`✓ DeviceRegistry deployed to ${contract.target || contract.address}`);

  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "local.json"),
    JSON.stringify(
      {
        network: `http://127.0.0.1:${localPort}`,
        DeviceRegistry: contract.target || contract.address,
        owner: signer.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`✓ deployments/local.json written`);
  console.log("Local deployment complete. Use this address for local integration.");
  await server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
