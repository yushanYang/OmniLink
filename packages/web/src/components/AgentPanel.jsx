import { Bot, Send, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { askAgent } from "../lib/aiClient";
import { sendDeviceCommand } from "../lib/peer";

export function AgentPanel({ devices, onEvent, t }) {
  const [message, setMessage] = useState(t("agent.defaultMessage"));
  const [agentState, setAgentState] = useState({
    reply: t("agent.ready"),
    toolCall: null,
  });
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    setMessage(t("agent.defaultMessage"));
    setAgentState((current) => ({
      ...current,
      reply: current.toolCall ? current.reply : t("agent.ready"),
    }));
  }, [t]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!message.trim()) return;

    setIsThinking(true);
    const result = await askAgent({ message, devices });
    setAgentState(result);
    if (result.fallbackReason) {
      onEvent({
        title: t("agent.fallbackTitle"),
        detail: `${t("agent.fallbackDetail")} ${result.fallbackReason}`,
      });
    }
    setIsThinking(false);
  }

  async function handleRunTool() {
    if (!agentState.toolCall) return;
    const result = await sendDeviceCommand(agentState.toolCall.arguments);
    onEvent({
      title: t("agent.toolExecuted"),
      detail: `${result.action} -> ${result.deviceId}. ${t("source")}: ${result.source}.`,
    });
  }

  return (
    <section className="panel agent-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("agent.eyebrow")}</p>
          <h2>{t("agent.title")}</h2>
        </div>
        <Bot size={21} />
      </div>

      <div className="chat-output">
        <p>{agentState.reply}</p>
        {agentState.toolCall && (
          <pre>{JSON.stringify(agentState.toolCall, null, 2)}</pre>
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("agent.placeholder")}
        />
        <button type="submit" disabled={isThinking}>
          <Send size={18} />
          {isThinking ? t("agent.thinking") : t("agent.ask")}
        </button>
      </form>

      <button className="secondary-button" onClick={handleRunTool} disabled={!agentState.toolCall}>
        <Wrench size={18} />
        {t("agent.runTool")}
      </button>
    </section>
  );
}
