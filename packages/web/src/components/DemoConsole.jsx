import { Play, RefreshCw, Route, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { askAgent } from "../lib/aiClient";
import { checkServiceStatuses } from "../lib/health";
import { sendDeviceCommand } from "../lib/peer";
import { checkAccess, grantAccess } from "../lib/registry";
import { connectTronWallet } from "../lib/wallet";

const demoSteps = [
  { key: "connect", labelKey: "demo.stepConnect" },
  { key: "check", labelKey: "demo.stepCheck" },
  { key: "grant", labelKey: "demo.stepGrant" },
  { key: "unlock", labelKey: "demo.stepUnlock" },
  { key: "ask", labelKey: "demo.stepAsk" },
  { key: "runTool", labelKey: "demo.stepRunTool" },
];

export function DemoConsole({ wallet, onWalletChange, devices, selectedDevice, onEvent, t }) {
  const [serviceStatuses, setServiceStatuses] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(null);

  useEffect(() => {
    refreshStatuses();
  }, []);

  async function refreshStatuses() {
    setIsChecking(true);
    const statuses = await checkServiceStatuses();
    setServiceStatuses(statuses);
    setIsChecking(false);
  }

  async function runDemoFlow() {
    if (!selectedDevice) {
      onEvent({
        title: t("demo.blocked"),
        detail: t("demo.noDevice"),
      });
      return;
    }

    setIsRunning(true);
    try {
      setActiveStep("connect");
      const nextWallet = wallet ?? (await connectTronWallet());
      if (!wallet) {
        onWalletChange(nextWallet);
      }
      onEvent({
        title: t("demo.walletReady"),
        detail: `${nextWallet.address} ${t("via")} ${nextWallet.source}.`,
      });

      setActiveStep("check");
      const access = await checkAccess(nextWallet.address, selectedDevice.id);
      onEvent({
        title: t("demo.accessChecked"),
        detail: `${access.allowed ? t("demo.allowed") : t("demo.notAllowed")} ${t("for")} ${selectedDevice.id}. ${t("source")}: ${access.source}.`,
      });

      setActiveStep("grant");
      const grant = await grantAccess({
        walletAddress: nextWallet.address,
        deviceId: selectedDevice.id,
        durationHours: 24,
      });
      onEvent({
        title: t("demo.accessGranted"),
        detail: `${grant.txId} ${t("for")} ${selectedDevice.id}. ${t("source")}: ${grant.source}.`,
      });

      setActiveStep("unlock");
      const command = await sendDeviceCommand({
        deviceId: selectedDevice.id,
        action: "unlock",
      });
      onEvent({
        title: t("demo.deviceCommand"),
        detail: `${command.action} -> ${command.deviceId}. ${t("source")}: ${command.source}.`,
      });

      setActiveStep("ask");
      const agent = await askAgent({
        message: `Unlock ${selectedDevice.name}`,
        devices,
      });
      onEvent({
        title: t("demo.agentReplied"),
        detail: agent.toolCall ? `${t("demo.toolSuggested")}: ${agent.toolCall.name}.` : t("demo.noTool"),
      });

      setActiveStep("runTool");
      if (agent.toolCall?.name === "sendDeviceCommand") {
        const toolResult = await sendDeviceCommand(agent.toolCall.arguments);
        onEvent({
          title: t("demo.complete"),
          detail: `${toolResult.action} -> ${toolResult.deviceId}. ${t("source")}: ${toolResult.source}.`,
        });
      } else {
        onEvent({
          title: t("demo.complete"),
          detail: t("demo.textOnly"),
        });
      }
    } catch (error) {
      onEvent({
        title: t("demo.failedTitle"),
        detail: error.message,
      });
    } finally {
      setActiveStep(null);
      setIsRunning(false);
      refreshStatuses();
    }
  }

  return (
    <section className="panel demo-console">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("demo.eyebrow")}</p>
          <h2>{t("demo.title")}</h2>
        </div>
        <Server size={21} />
      </div>

      <div className="console-grid">
        <div className="service-board">
          <div className="console-subhead">
            <strong>{t("demo.serviceStatus")}</strong>
            <button onClick={refreshStatuses} disabled={isChecking}>
              <RefreshCw size={16} />
              {isChecking ? t("demo.checking") : t("demo.refresh")}
            </button>
          </div>
          <div className="service-list">
            {serviceStatuses.map((service) => (
              <article className="service-row" key={service.key}>
                <span className={`status-dot ${service.status}`} />
                <div>
                  <strong>{t(`service.${service.key}`)}</strong>
                  <small>{t(`demo.${service.status}`)} · {service.detail === "No URL configured" ? t("demo.noUrl") : service.detail}</small>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="demo-runner">
          <div className="console-subhead">
            <strong>{t("demo.oneClick")}</strong>
            <button className="run-demo-button" onClick={runDemoFlow} disabled={isRunning || !selectedDevice}>
              <Play size={16} />
              {isRunning ? t("demo.running") : t("demo.run")}
            </button>
          </div>

          <div className="step-list">
            {demoSteps.map((step, index) => (
              <div className={`step-row ${activeStep === step.key ? "active" : ""}`} key={step.key}>
                <span>{index + 1}</span>
                <p>{t(step.labelKey)}</p>
                {activeStep === step.key && <Route size={15} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
