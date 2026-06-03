import { Lock, Lightbulb, Speaker, Radio } from "lucide-react";

const iconByType = {
  "Smart Lock": Lock,
  Light: Lightbulb,
  Speaker,
};

export function DeviceList({ devices, selectedDeviceId, onSelect, t }) {
  return (
    <section className="panel device-list">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("devices.eyebrow")}</p>
          <h2>{t("devices.title")}</h2>
        </div>
        <Radio size={20} />
      </div>

      <div className="device-stack">
        {devices.map((device) => {
          const Icon = iconByType[device.type] ?? Radio;
          const isSelected = selectedDeviceId === device.id;

          return (
            <button
              className={`device-row ${isSelected ? "selected" : ""}`}
              key={device.id}
              onClick={() => onSelect(device.id)}
            >
              <span className="device-icon">
                <Icon size={19} />
              </span>
              <span className="device-copy">
                <strong>{device.name}</strong>
                <small>{device.id}</small>
              </span>
              <span className={`status-dot ${device.status}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
