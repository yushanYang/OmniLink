export async function connectTronWallet() {
  const tronWeb = window.tronWeb;

  if (window.tronLink?.request) {
    await window.tronLink.request({ method: "tron_requestAccounts" });
  }

  if (tronWeb?.defaultAddress?.base58) {
    return {
      address: tronWeb.defaultAddress.base58,
      network: tronWeb.fullNode?.host ?? "TronLink",
      source: "tronlink",
    };
  }

  return {
    address: "TMock8JbQWj5rG9A4Demo",
    network: "Mock wallet",
    source: "mock",
  };
}
