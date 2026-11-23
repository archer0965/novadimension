import { get, put, list } from "@vercel/blob";

/**
 * Append-only credit ledger for audit / idempotency / refunds.
 * Balance of truth remains CreditAccount; ledger explains mutations.
 */

export type LedgerEntryType =
  | "welcome"
  | "purchase"
  | "consume"
  | "refund"
  | "subscription";

export type CreditLedgerEntry = {
  id: string;
  accountId: string;
  type: LedgerEntryType;
  /** Signed credit delta (+ grant / refund, − consume). 0 for subscription-only. */
  creditDelta: number;
  clientRequestId?: string;
  paymentId?: string;
  reason?: string;
  createdAt: string;
};

const PREFIX = "credits/ledger/";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function entryPath(accountId: string, entryId: string) {
  const safeAccount = accountId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const safeId = entryId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `${PREFIX}${safeAccount}/${safeId}.json`;
}

function idempotencyPath(
  accountId: string,
  kind: "consume" | "welcome" | "payment",
  key: string,
) {
  const safeAccount = accountId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const safeKey = key.replace(/[^\w.-]+/g, "_").slice(0, 100);
  return `${PREFIX}${safeAccount}/_idemp/${kind}-${safeKey}.json`;
}

export async function appendLedgerEntry(
  entry: CreditLedgerEntry,
): Promise<void> {
  const token = blobToken();
  if (!token) return;
  await put(entryPath(entry.accountId, entry.id), JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token,
    cacheControlMaxAge: 0,
  });
}

/** Returns existing ledger entry id if this idempotency key was already used. */
export async function getLedgerIdempotency(
  accountId: string,
  kind: "consume" | "welcome" | "payment",
  key: string,
): Promise<string | null> {
  const token = blobToken();
  if (!token || !accountId || !key) return null;
  try {
    const result = await get(idempotencyPath(accountId, kind, key), {
      access: "private",
      token,
    });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as { entryId?: string };
    return parsed.entryId || null;
  } catch {
    return null;
  }
}

export async function saveLedgerIdempotency(
  accountId: string,
  kind: "consume" | "welcome" | "payment",
  key: string,
  entryId: string,
): Promise<void> {
  const token = blobToken();
  if (!token || !accountId || !key) return;
  await put(
    idempotencyPath(accountId, kind, key),
    JSON.stringify({ entryId, createdAt: new Date().toISOString() }),
    {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
      token,
      cacheControlMaxAge: 0,
    },
  );
}

export async function listRecentLedger(
  accountId: string,
  limit = 20,
): Promise<CreditLedgerEntry[]> {
  const token = blobToken();
  if (!token || !accountId) return [];
  try {
    const safeAccount = accountId.replace(/[^\w.-]+/g, "_").slice(0, 80);
    const { blobs } = await list({
      prefix: `${PREFIX}${safeAccount}/`,
      token,
      limit: Math.min(100, limit * 3),
    });
    const entries: CreditLedgerEntry[] = [];
    for (const blob of blobs) {
      if (blob.pathname.includes("/_idemp/")) continue;
      try {
        const res = await fetch(blob.url);
        if (!res.ok) continue;
        entries.push((await res.json()) as CreditLedgerEntry);
      } catch {
        // skip
      }
    }
    return entries
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function newLedgerId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
