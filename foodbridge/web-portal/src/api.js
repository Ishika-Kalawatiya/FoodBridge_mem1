const configuredApi = import.meta.env.VITE_FOODBRIDGE_API_URL?.trim().replace(/\/+$/, "") ?? "";

function getApiBase() {
  if (!configuredApi || typeof window === "undefined") return configuredApi;
  try {
    const apiUrl = new URL(configuredApi, window.location.origin);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    if (localHosts.has(apiUrl.hostname) && localHosts.has(window.location.hostname)) {
      apiUrl.hostname = window.location.hostname;
    }
    return apiUrl.origin;
  } catch {
    return configuredApi;
  }
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const base = getApiBase();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    throw new Error(
      `Can't reach FoodBridge at ${base || window.location.origin}. Check that the backend is running on port 4000 and that CORS allows this page origin.`,
      { cause },
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}
