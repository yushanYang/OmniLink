/**
 * TronLink 钱包连接（前端只读 + 调用合约）。
 * TronLink 会向页面注入 window.tronWeb / window.tronLink。
 */

export async function connectWallet() {
  const { tronLink, tronWeb } = window;

  if (tronLink) {
    // 新版 TronLink 需显式请求授权
    const res = await tronLink.request({ method: "tron_requestAccounts" });
    if (res?.code && res.code !== 200) {
      throw new Error(res.message || "用户拒绝授权");
    }
  }

  if (!window.tronWeb || !window.tronWeb.defaultAddress?.base58) {
    throw new Error("未检测到 TronLink，请安装并解锁钱包");
  }

  return window.tronWeb.defaultAddress.base58;
}

/**
 * 获取一个绑定了用户钱包的合约实例。
 * @param {string} address  DeviceRegistry 合约地址
 * @param {object[]} abi     合约 ABI（来自 @omnilink/contracts/build/DeviceRegistry.json）
 */
export async function getContract(address, abi) {
  if (!window.tronWeb) throw new Error("TronWeb 未就绪");
  return window.tronWeb.contract(abi, address);
}
