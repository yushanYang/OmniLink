import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import solc from "solc";
import Ganache from "ganache";
import { ContractFactory, JsonRpcProvider, Wallet, toUtf8Bytes, ZeroAddress } from "ethers";

const root = path.resolve(".");
const contractsDir = path.join(root, "contracts");
const buildDir = path.join(root, "build");
const contractFile = "DeviceRegistry.sol";
const contractName = "DeviceRegistry";

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
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
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
  if (!artifact) throw new Error(`无法编译 ${contractName}`);

  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(
    path.join(buildDir, `${contractName}.json`),
    JSON.stringify({ contractName, abi: artifact.abi, bytecode: artifact.evm.bytecode.object }, null, 2),
    "utf8"
  );

  return { abi: artifact.abi, bytecode: artifact.evm.bytecode.object };
}

async function withGanache(fn) {
  const ownerPrivateKey = "0xda13b6f3fcf96a29ae5f4104f3a89c28da30098d639fc7eeb08644eb1f25a2a1";
  const guestPrivateKey = "0x23eb2f79d5f44e2f7314ded2306350a4ec9cc9bf0218b3634b911a81e98426c5";
  const server = Ganache.server({
    wallet: {
      accounts: [
        { secretKey: ownerPrivateKey, balance: "0x1000000000000000000" },
        { secretKey: guestPrivateKey, balance: "0x1000000000000000000" },
      ],
    },
  });

  await server.listen(8545);
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const ownerSigner = new Wallet(ownerPrivateKey, provider);
  const guestSigner = new Wallet(guestPrivateKey, provider);

  try {
    await fn(provider, ownerSigner, guestSigner);
  } finally {
    await server.close();
  }
}

test("DeviceRegistry: compile artifact exists", () => {
  const artifact = compileContract();
  assert.ok(artifact.abi.length > 0, "ABI 应该存在");
  assert.ok(artifact.bytecode.length > 0, "Bytecode 应该存在");
});

test("DeviceRegistry: lifecycle flow and access controls", async () => {
  const artifact = compileContract();

  await withGanache(async (provider, ownerSigner, guestSigner) => {
    const ownerAddr = await ownerSigner.getAddress();
    const guestAddr = await guestSigner.getAddress();

    const factory = new ContractFactory(artifact.abi, artifact.bytecode, ownerSigner);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const ownerContract = contract.connect(ownerSigner);
    const guestContract = contract.connect(guestSigner);

    async function sendOwnerTx(method, params) {
      const latest = Number(await provider.send("eth_getTransactionCount", [ownerAddr, "latest"]));
      const pending = Number(await provider.send("eth_getTransactionCount", [ownerAddr, "pending"]));
      const nonce = Math.max(latest, pending);
      const tx = await ownerContract[method](...params, { gasLimit: 5_000_000, nonce });
      await tx.wait();
      return tx;
    }

    const deviceId = "door-001";
    const pubkey = "test-pubkey";
    const connInfo = "room-123";

    await sendOwnerTx("registerDevice", [deviceId, pubkey, connInfo]);

    const [id, pubkeyResult, owner, connInfoResult, registered] = await contract.getDevice(deviceId);
    assert.equal(id, deviceId);
    assert.equal(owner, ZeroAddress);
    assert.equal(connInfoResult, connInfo);
    assert.equal(registered, true);
    assert.equal(pubkeyResult, "test-pubkey");

    await assert.rejects(
      provider.call({ to: contract.target || contract.address, data: contract.interface.encodeFunctionData('registerDevice', [deviceId, pubkey, connInfo]), from: ownerAddr }),
      /device already registered/
    );

    await sendOwnerTx("bindOwner", [deviceId]);
    const [, , boundOwner] = await contract.getDevice(deviceId);
    assert.equal(boundOwner, ownerAddr);
    assert.equal(await contract.checkAccess(deviceId, ownerAddr), true);

    await assert.rejects(
      provider.call({ to: contract.target || contract.address, data: contract.interface.encodeFunctionData('bindOwner', [deviceId]), from: ownerAddr }),
      /device already claimed/
    );

    const now = (await provider.getBlock("latest")).timestamp;
    const expiry = now + 10;
    await sendOwnerTx("grantAccess", [deviceId, guestAddr, expiry]);
    assert.equal(await contract.checkAccess(deviceId, guestAddr), true);

    await provider.send("evm_increaseTime", [20]);
    await provider.send("evm_mine", []);
    assert.equal(await contract.checkAccess(deviceId, guestAddr), false);

    await sendOwnerTx("grantAccess", [deviceId, guestAddr, 0]);
    assert.equal(await contract.checkAccess(deviceId, guestAddr), true);

    await sendOwnerTx("revokeAccess", [deviceId, guestAddr]);
    assert.equal(await contract.checkAccess(deviceId, guestAddr), false);

    await assert.rejects(
      provider.call({ to: contract.target || contract.address, data: contract.interface.encodeFunctionData('grantAccess', [deviceId, guestAddr, 0]), from: guestAddr }),
      /not device owner/
    );

    await sendOwnerTx("updateConnInfo", [deviceId, "new-room"]);
    const [, , , updatedConnInfo] = await contract.getDevice(deviceId);
    assert.equal(updatedConnInfo, "new-room");
  });
});
