/** Client helpers for NovaOS / anonymous account identity */

const ACCOUNT_KEY = "nd_account_id";
const AUTH_FLAG_KEY = "nd_novaos_auth";

export function isGuestAccountId(id: string): boolean {
  const normalized = (id || "").trim();
  if (!normalized || normalized === "guest") return true;
  if (normalized.startsWith("u_")) return true;
  return false;
}

/** Read stored account id without creating an anonymous one. */
export function readAccountId(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setAccountId(id: string, authenticated = false): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, id);
    if (authenticated) {
      localStorage.setItem(AUTH_FLAG_KEY, "1");
    }
  } catch {
    // ignore
  }
}

export function isAuthenticatedClient(): boolean {
  try {
    if (localStorage.getItem(AUTH_FLAG_KEY) === "1") {
      const id = localStorage.getItem(ACCOUNT_KEY);
      return Boolean(id && !isGuestAccountId(id));
    }
    const id = localStorage.getItem(ACCOUNT_KEY);
    return Boolean(id && !isGuestAccountId(id));
  } catch {
    return false;
  }
}

/**
 * Prefer authenticated NovaOS account id.
 * Do not mint anonymous free-credit ids — guests stay as "guest" with 0 credits.
 */
export function getAccountIdForRequest(): string {
  try {
    const existing = localStorage.getItem(ACCOUNT_KEY);
    if (existing && !isGuestAccountId(existing)) return existing;
    if (existing) return existing;
  } catch {
    // fall through
  }
  return "guest";
}

/** Decode JWT payload without verifying signature (client-side identity hint). */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function accountIdFromAccessToken(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const sub = payload.sub ?? payload.user_id ?? payload.userId ?? payload.uid;
  if (typeof sub === "string" && sub.trim()) {
    return `novaos_${sub.trim()}`;
  }
  return null;
}
