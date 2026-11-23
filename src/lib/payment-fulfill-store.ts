import { get, put } from "@vercel/blob";

/** Idempotent record of a paid fulfill so the same paymentId never double-grants. */
export type PaymentFulfillRecord = {
  paymentId: string;
  accountId: string;
  planId: string;
  createdAt: string;
  creditsAfter: number;
  subscriptionEndsAt: string | null;
};

const PREFIX = "payments/fulfill/";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function pathFor(paymentId: string) {
  const safe = paymentId.replace(/[^\w.-]+/g, "_").slice(0, 120);
  return `${PREFIX}${safe}.json`;
}

export async function getPaymentFulfill(
  paymentId: string,
): Promise<PaymentFulfillRecord | null> {
  const token = blobToken();
  if (!token || !paymentId) return null;
  try {
    const result = await get(pathFor(paymentId), { access: "private", token });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as PaymentFulfillRecord;
  } catch {
    return null;
  }
}

export async function savePaymentFulfill(
  record: PaymentFulfillRecord,
): Promise<void> {
  const token = blobToken();
  if (!token || !record.paymentId) return;
  await put(pathFor(record.paymentId), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token,
    cacheControlMaxAge: 0,
  });
}
