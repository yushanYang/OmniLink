import { apiConfig, buildUrl } from "./config";
import { requestJson } from "./http";

const services = [
  {
    key: "registry",
    label: "Registry API",
    baseUrl: apiConfig.registryBaseUrl,
  },
  {
    key: "peer",
    label: "P2P API",
    baseUrl: apiConfig.peerBaseUrl,
  },
  {
    key: "ai",
    label: "AI API",
    baseUrl: apiConfig.aiBaseUrl,
  },
];

export async function checkServiceStatuses() {
  return Promise.all(services.map(checkServiceStatus));
}

async function checkServiceStatus(service) {
  if (!service.baseUrl) {
    return {
      ...service,
      status: "mock",
      detail: "No URL configured",
    };
  }

  try {
    const result = await requestJson(buildUrl(service.baseUrl, "/health"));
    return {
      ...service,
      status: result.ok === false ? "failed" : "connected",
      detail: result.service ?? service.baseUrl,
    };
  } catch (error) {
    return {
      ...service,
      status: "failed",
      detail: error.message,
    };
  }
}
