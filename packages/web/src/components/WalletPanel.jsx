import { Wallet, RefreshCw } from "lucide-react";
import { connectTronWallet } from "../lib/wallet";

export function WalletPanel({ wallet, onWalletChange, t }) {
  async function handleConnect() {
    const nextWallet = await connectTronWallet();
    onWalletChange(nextWallet);
  }

  return (
    <section className="panel wallet-panel">
      <div>
        <p className="eyebrow">{t("wallet.eyebrow")}</p>
        <h2>{t("wallet.title")}</h2>
        <p className="muted">{t("wallet.copy")}</p>
      </div>

      <div className="wallet-card">
        <Wallet size={22} />
        <div>
          <span>{wallet?.address ?? t("wallet.none")}</span>
          <small>{wallet?.network ?? t("wallet.connectFirst")}</small>
        </div>
      </div>

      <button className="primary-button" onClick={handleConnect}>
        <RefreshCw size={18} />
        {wallet ? t("wallet.reconnect") : t("wallet.connect")}
      </button>
    </section>
  );
}
