const PROD_API = "https://895d-187-57-105-54.ngrok-free.app/api";
const DEV_API = "/api";

function getApiBase(): string {
  if (typeof window === "undefined") return DEV_API;
  const saved = localStorage.getItem("cuidarbem_api_url");
  if (saved) return saved;
  const isNative = window.location.protocol === "capacitor:" || window.location.protocol === "capacitor-electron:" || window.location.protocol === "file:";
  return isNative ? PROD_API : DEV_API;
}

export function API_URL(): string {
  return getApiBase();
}

export function setApiUrl(url: string) {
  localStorage.setItem("cuidarbem_api_url", url);
}

export function getApiUrl(): string {
  return localStorage.getItem("cuidarbem_api_url") || "";
}

export function getCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("cuidarbem_user");
  if (!user) return null;
  try {
    const parsed = JSON.parse(user);
    return parsed.companyId ?? null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cuidarbem_token");
}

async function saveOfflineRequest(url: string, method: string, body: any, headers: Record<string, string>) {
  const { saveOffline, registerSync } = await import("@/lib/offline");
  await saveOffline(url, method, body, headers);
  registerSync();
}

export async function companyFetch(path: string, init?: RequestInit): Promise<Response> {
  const companyId = getCompanyId();
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (companyId) {
    headers.set("X-Company-Id", companyId);
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const method = init?.method || "GET";
  const isWrite = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

  try {
    const response = await fetch(`${API_URL()}${path}`, { ...init, headers });
    return response;
  } catch (err) {
    if (isWrite && typeof window !== "undefined" && !navigator.onLine) {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      const headersObj: Record<string, string> = {};
      headers.forEach((v, k) => { headersObj[k] = v; });
      await saveOfflineRequest(`${API_URL()}${path}`, method, body, headersObj);
      return new Response(JSON.stringify({ offline: true, queued: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }
}
