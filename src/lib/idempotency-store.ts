import { get, put } from "@vercel/blob";

/** Short-lived generate result keyed by account + clientRequestId */
export type IdempotentGenerateResult = {
  accountId: string;
  clientRequestId: string;
  createdAt: string;
  /** Full JSON body previously returned to the client */
  response: Record<string, unknown>;
};

const PREFIX = "idempotency/generate/";
/** Keep results briefly so retries do not double-charge or re-run fal */
const TTL_MS = 15 * 60 * 1000;

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function pathFor(accountId: string, clientRequestId: string) {
  const safeAccount = accountId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const safeReq = clientRequestId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `${PREFIX}${safeAccount}/${safeReq}.json`;
}

export async function getIdempotentResult(
  accountId: string,
  clientRequestId: string,
): Promise<IdempotentGenerateResult | null> {
  const token = blobToken();
  if (!token || !accountId || !clientRequestId) return null;

  try {
    const result = await get(pathFor(accountId, clientRequestId), {
      access: "private",
      token,
    });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as IdempotentGenerateResult;
    const age = Date.now() - new Date(parsed.createdAt).getTime();
    if (!Number.isFinite(age) || age > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveIdempotentResult(
  accountId: string,
  clientRequestId: string,
  response: Record<string, unknown>,
): Promise<void> {
  const token = blobToken();
  if (!token || !accountId || !clientRequestId) return;

  const payload: IdempotentGenerateResult = {
    accountId,
    clientRequestId,
    createdAt: new Date().toISOString(),
    response,
  };

  await put(pathFor(accountId, clientRequestId), JSON.stringify(payload), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token,
    cacheControlMaxAge: 0,
  });
}
