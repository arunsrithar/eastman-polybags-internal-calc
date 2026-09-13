/**
 * REST API for saved quotes.
 * Mirrors the request() pattern in settingsApi.js.
 */

import { refreshApi } from "./authApi";

const API_ROOT = (
  import.meta.env.VITE_API_BASE || "http://localhost:3001"
).replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api/quotes`;

async function request(url, options = {}, retry = true) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Auto-refresh on 401 — attempt once, then give up.
  if (res.status === 401 && retry) {
    try {
      await refreshApi();
      return request(url, options, false);
    } catch {
      // Refresh failed — dispatch event so AuthContext can log out.
      window.dispatchEvent(new CustomEvent("auth:logout"));
      const err = new Error("Session expired — please log in again");
      err.status = 401;
      throw err;
    }
  }

  if (res.status === 204) {
    return null;
  }

  const isJson = (res.headers.get("content-type") || "").includes(
    "application/json",
  );
  const body = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    if (res.status === 409) err.code = "DUPLICATE";
    throw err;
  }

  return body;
}

export function listQuotes(calcKey) {
  return request(`${API_BASE}/${encodeURIComponent(calcKey)}`);
}

export function countQuotes(calcKey) {
  return request(`${API_BASE}/${encodeURIComponent(calcKey)}/count`).then(
    (body) => body?.count ?? 0,
  );
}

export function createQuote(calcKey, payload) {
  return request(`${API_BASE}/${encodeURIComponent(calcKey)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteQuote(calcKey, id) {
  return request(
    `${API_BASE}/${encodeURIComponent(calcKey)}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function getNextQuoteId(calcKey) {
  return request(`${API_BASE}/${encodeURIComponent(calcKey)}/next-id`).then(
    (body) => body?.quoteId ?? "",
  );
}

export function getCustomerNames() {
  return request(`${API_BASE}/customers`);
}
