export const apiConfig = {
  registryBaseUrl: normalizeBaseUrl(import.meta.env.VITE_OMNILINK_REGISTRY_API),
  peerBaseUrl: normalizeBaseUrl(import.meta.env.VITE_OMNILINK_PEER_API),
  aiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_OMNILINK_AI_API),
};

export function getRuntimeMode() {
  const enabledAdapters = [
    apiConfig.registryBaseUrl && "Registry API",
    apiConfig.peerBaseUrl && "P2P API",
    apiConfig.aiBaseUrl && "AI API",
  ].filter(Boolean);

  return {
    label: enabledAdapters.length > 0 ? "API mode" : "Mock mode",
    enabledAdapters,
  };
}

export function buildUrl(baseUrl, path) {
  if (!baseUrl) return null;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeBaseUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}
