/**
 * On-chain runtime: reads DeviceRegistry on TRON (Nile testnet or any EVM-compat).
 * Replaces mock-runtime for production/demo when a real contract address is configured.
 *
 * Env vars:
 *   DEVICE_REGISTRY_ADDRESS — Base58 contract address (required)
 *   TRON_FULL_NODE — RPC endpoint (default: https://nile.trongrid.io)
 *   TRON_PRIVATE_KEY — for write ops (grantAccess); read-only ops work without it
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ABI_PATH = path.resolve(__dirname, "../../contracts/build/DeviceRegistry.json");

let _tronWeb = null;
let _contract = null;

function getTronWeb() {
  if (_tronWeb) return _tronWeb;
  const TronWeb = globalThis._TronWebClass;
  if (!TronWeb || typeof TronWeb !== "function") throw new Error("TronWeb not loaded (check import)");

  const fullNode = process.env.TRON_FULL_NODE || "https://nile.trongrid.io";
  const privateKey = process.env.TRON_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";

  _tronWeb = new TronWeb({ fullHost: fullNode, privateKey });
  return _tronWeb;
}

function getContract() {
  if (_contract) return _contract;
  const tronWeb = getTronWeb();
  const address = process.env.DEVICE_REGISTRY_ADDRESS;
  if (!address) throw new Error("DEVICE_REGISTRY_ADDRESS not set");

  const artifact = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
  const abi = artifact.abi || artifact;
  _contract = tronWeb.contract(abi, address);
  return _contract;
}

/**
 * Creates a chain-backed runtime with the same interface as mock-runtime.
 */
export async function createChainRuntime() {
  // Lazy load TronWeb
  const mod = await import("tronweb");
  globalThis._TronWebClass = mod.TronWeb || mod.default?.TronWeb || mod.default;

  const contract = getContract();
  const tronWeb = getTronWeb();

  return {
    listDevices: async (context = {}) => {
      try {
        const count = await contract.deviceCount().call();
        const deviceCount = Number(count);
        const devices = [];

        for (let i = 0; i < deviceCount; i++) {
          const key = await contract.deviceKeyAt(i).call();
          // getDevice returns: (id, pubkey, owner, connInfo, registered)
          const raw = await contract.getDevice(key).call();
          // Try calling with deviceId string — contract accepts string or bytes32
          // Fallback: use key directly if getDevice(string) fails
          const device = parseDevice(raw, key);
          if (device.registered) {
            const userAddress = context.userAddress || "";
            let access = "none";
            try {
              const allowed = await contract.checkAccess(device.deviceId, userAddress).call();
              access = allowed ? "granted" : "none";
            } catch { access = "unknown"; }
            devices.push({ ...device, access });
          }
        }
        return devices;
      } catch (err) {
        console.error("[chain-runtime] listDevices failed:", err.message);
        return [];
      }
    },

    checkAccess: async (deviceId, userAddress = "", context = {}) => {
      try {
        // Skip chain call if userAddress is not a valid TRON address (demo mode)
        if (!isValidTronAddress(userAddress)) {
          return true; // allow in demo mode
        }
        const allowed = await contract.checkAccess(deviceId, userAddress).call();
        return Boolean(allowed);
      } catch (err) {
        console.warn("[chain-runtime] checkAccess failed:", err.message);
        // Fallback: allow in demo mode
        return context.allowMockAccess === true;
      }
    },


    grantAccess: async ({ deviceId, userAddress, expiry, durationHours }, context = {}) => {
      try {
        if (!process.env.TRON_PRIVATE_KEY) {
          return { ok: false, error: "TRON_PRIVATE_KEY not configured for write ops" };
        }
        const expiryTimestamp = expiry
          ? Number(expiry)
          : Math.floor(Date.now() / 1000) + Number(durationHours || 4) * 3600;

        const tx = await contract.grantAccess(deviceId, userAddress, expiryTimestamp).send({
          feeLimit: 100_000_000,
          shouldPollResponse: true,
        });

        return {
          ok: true,
          granted: true,
          deviceId,
          userAddress,
          expiry: expiryTimestamp,
          expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
          txId: tx,
          source: "chain-runtime",
        };
      } catch (err) {
        return { ok: false, error: err.message, source: "chain-runtime" };
      }
    },
  };
}

/**
 * Parse raw contract return into a normalized device object.
 * Handles both array (positional) and object (named) formats from TronWeb.
 */
export function parseDevice(raw, key) {
  // Solidity returns: (string id, bytes pubkey, address owner, string connInfo, bool registered)
  // TronWeb may return as array or object depending on version
  if (Array.isArray(raw)) {
    return {
      deviceId: raw[0] || "",
      id: raw[0] || "",
      name: raw[0] || "Unknown Device",
      pubkey: raw[1] || "",
      owner: raw[2] || "",
      connInfo: raw[3] || "",
      registered: Boolean(raw[4]),
      type: "Smart Lock",
      status: "online",
    };
  }
  return {
    deviceId: raw.id || raw.deviceId || "",
    id: raw.id || raw.deviceId || "",
    name: raw.id || "Unknown Device",
    pubkey: raw.pubkey || "",
    owner: raw.owner || "",
    connInfo: raw.connInfo || "",
    registered: Boolean(raw.registered),
    type: "Smart Lock",
    status: "online",
  };
}

/**
 * Check if chain runtime can be used (contract address configured).
 */
export function isChainConfigured() {
  return Boolean(process.env.DEVICE_REGISTRY_ADDRESS && process.env.DEVICE_REGISTRY_ADDRESS !== "TXxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
}

/**
 * Quick check if a string looks like a valid TRON Base58 address (T + 33 chars).
 */
export function isValidTronAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}
