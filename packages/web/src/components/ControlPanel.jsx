import { KeyRound, Lock, Unlock, Zap } from "lucide-react";
import { checkAccess, grantAccess } from "../lib/registry";
import { sendDeviceCommand } from "../lib/peer";

export function ControlPanel({ wallet, device, onEvent, t }) {
  if (!device) {
    return (
      <section className="panel empty-state">
        <h2>{t("control.emptyTitle")}</h2>
        <p className="muted">{t("control.emptyCopy")}</p>
      </section>
    );
  }

  async function handleCheckAccess() {
    const result = await checkAccess(wallet?.address, device.id);
    onEvent({
      title: t("control.accessChecked"),
      detail: `${result.allowed ? t("control.activeAccess") : t("control.noAccess")} ${t("source")}: ${result.source}.`,
    });
  }

  async function handleGrantAccess() {
    const result = await grantAccess({
      walletAddress: wallet?.address,
      deviceId: device.id,
      durationHours: 24,
    });
    onEvent({
      title: result.source === "registry-api" ? t("control.grantSent") : t("control.grantMocked"),
      detail: `${result.txId} ${t("for")} ${device.id}. ${t("source")}: ${result.source}.`,
    });
  }

  async function handleCommand(action) {
    const result = await sendDeviceCommand({ deviceId: device.id, action });
    onEvent({
      title: t("control.commandSent"),
      detail: `${result.action} -> ${result.deviceId} ${t("via")} ${result.transport}. ${t("source")}: ${result.source}.`,
    });
  }

  return (
    <section className="panel control-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("control.eyebrow")}</p>
          <h2>{device.name}</h2>
        </div>
        <span className={`access-pill ${device.access}`}>{device.access}</span>
      </div>

      <dl className="device-meta">
        <div>
          <dt>{t("control.deviceId")}</dt>
          <dd>{device.id}</dd>
        </div>
        <div>
          <dt>{t("control.owner")}</dt>
          <dd>{device.owner}</dd>
        </div>
        <div>
          <dt>{t("control.expires")}</dt>
          <dd>{device.expiresAt}</dd>
        </div>
        <div>
          <dt>{t("control.connection")}</dt>
          <dd>{device.connection}</dd>
        </div>
      </dl>

      <div className="button-grid">
        <button onClick={handleCheckAccess}>
          <KeyRound size={18} />
          {t("control.check")}
        </button>
        <button onClick={handleGrantAccess} disabled={!wallet}>
          <Zap size={18} />
          {t("control.grant")}
        </button>
        <button onClick={() => handleCommand("unlock")} disabled={device.status !== "online"}>
          <Unlock size={18} />
          {t("control.unlock")}
        </button>
        <button onClick={() => handleCommand("lock")} disabled={device.status !== "online"}>
          <Lock size={18} />
          {t("control.lock")}
        </button>
      </div>
    </section>
  );
}
