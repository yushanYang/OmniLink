import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, ShieldCheck } from "lucide-react";
import { fetchDevices } from "./lib/registry";
import { getRuntimeMode } from "./lib/config";
import { createTranslator, defaultLanguage } from "./lib/i18n";
import { WalletPanel } from "./components/WalletPanel";
import { DeviceList } from "./components/DeviceList";
import { ControlPanel } from "./components/ControlPanel";
import { AgentPanel } from "./components/AgentPanel";
import { DemoConsole } from "./components/DemoConsole";
import { LanguageToggle } from "./components/LanguageToggle";

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem("omnilink-language") ?? defaultLanguage);
  const [wallet, setWallet] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    fetchDevices().then((nextDevices) => {
      setDevices(nextDevices);
      setSelectedDeviceId(nextDevices[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("omnilink-language", language);
    setEventLog([
      {
        title: t("app.initialEventTitle"),
        detail: t("app.initialEventDetail"),
      },
    ]);
  }, [language, t]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId),
    [devices, selectedDeviceId],
  );
  const runtimeMode = useMemo(() => getRuntimeMode(), []);

  function appendEvent(event) {
    setEventLog((current) => [event, ...current].slice(0, 8));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Boxes size={23} />
          </span>
          <div>
            <h1>OmniLink</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>
        <div className="topbar-status">
          <span>
            <ShieldCheck size={16} />
            {t("app.nileReady")}
          </span>
          <span>
            <Activity size={16} />
            {runtimeMode.label === "API mode" ? t("app.apiMode") : t("app.mockMode")}
          </span>
          <LanguageToggle language={language} onLanguageChange={setLanguage} t={t} />
        </div>
      </header>

      <section className="hero">
        <div>
          <h2>{t("app.heroTitle")}</h2>
          <p>{t("app.heroCopy")}</p>
          {runtimeMode.enabledAdapters.length > 0 && (
            <p className="runtime-note">
              {t("app.enabled")}: {runtimeMode.enabledAdapters.join(", ")}
            </p>
          )}
        </div>
        <div className="hero-summary">
          <span>{devices.length}</span>
          <small>{t("app.demoDevices")}</small>
        </div>
      </section>

      <DemoConsole
        wallet={wallet}
        onWalletChange={setWallet}
        devices={devices}
        selectedDevice={selectedDevice}
        onEvent={appendEvent}
        t={t}
      />

      <div className="workspace-grid">
        <WalletPanel wallet={wallet} onWalletChange={setWallet} t={t} />
        <DeviceList devices={devices} selectedDeviceId={selectedDeviceId} onSelect={setSelectedDeviceId} t={t} />
        <ControlPanel wallet={wallet} device={selectedDevice} onEvent={appendEvent} t={t} />
        <AgentPanel wallet={wallet} devices={devices} onEvent={appendEvent} t={t} />
      </div>

      <section className="panel event-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("app.integrationLog")}</p>
            <h2>{t("app.latestEvents")}</h2>
          </div>
        </div>
        <div className="event-list">
          {eventLog.map((event, index) => (
            <article key={`${event.title}-${index}`}>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
