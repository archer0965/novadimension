import { put, list } from "@vercel/blob";
import {
  appendLedgerEntry,
  getLedgerIdempotency,
  newLedgerId,
  saveLedgerIdempotency,
} from "@/lib/credit-ledger";
import { grantForPlan } from "@/lib/plan-grants";
import {
  getPaymentFulfill,
  savePaymentFulfill,
} from "@/lib/payment-fulfill-store";

export type CreditAccount = {
  id: string;
  credits: number;
  /** unlimited when subscriptionEndsAt is in the future */
  subscriptionEndsAt: string | null;
  /** One-time login welcome credit already granted */
  welcomeGranted?: boolean;
  updatedAt: string;
};

const PREFIX = "credits/";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Guests / anonymous local ids never get free credits.
 * Authenticated NovaOS ids look like UUID or `novaos_<uuid>`.
 */
export function isGuestAccountId(accountId: string): boolean {
  const id = (accountId || "").trim();
  if (!id || id === "guest" || id === "anonymous") return true;
  if (id.startsWith("guest-") || id.startsWith("u_")) return true;
  return false;
}

export function isAuthenticatedAccountId(accountId: string): boolean {
  return !isGuestAccountId(accountId);
}

function emptyAccount(id: string, credits = 0): CreditAccount {
  return {
    id,
    credits,
    subscriptionEndsAt: null,
    welcomeGranted: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAccount(id: string): Promise<CreditAccount> {
  const token = blobToken();

  if (!token) {
    // Without blob persistence, guests stay at 0; authed still need welcome API
    return emptyAccount(id, 0);
  }

  try {
    const { blobs } = await list({
      prefix: `${PREFIX}${id}`,
      token,
      limit: 1,
    });
    if (!blobs[0]) {
      return emptyAccount(id, 0);
    }
    const res = await fetch(blobs[0].url);
    if (!res.ok) throw new Error("fetch failed");
    const parsed = (await res.json()) as CreditAccount;
    return {
      ...parsed,
      id,
      credits: Math.max(0, Number(parsed.credits) || 0),
      welcomeGranted: Boolean(parsed.welcomeGranted),
    };
  } catch {
    return emptyAccount(id, 0);
  }
}

export async function saveAccount(account: CreditAccount): Promise<void> {
  const token = blobToken();
  if (!token) return;

  await put(`${PREFIX}${account.id}.json`, JSON.stringify(account), {
    access: "private",
    token,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

/**
 * Grant the one-time「登入贈 1 次」credit. Guests are rejected by callers.
 * Clearing cookies / new devices cannot re-claim once welcomeGranted is stored.
 * Ledger idempotency key welcome:<accountId> prevents parallel double-grant.
 */
export async function grantWelcomeCreditOnce(
  accountId: string,
): Promise<CreditAccount> {
  if (isGuestAccountId(accountId)) {
    return emptyAccount(accountId, 0);
  }

  const existingIdemp = await getLedgerIdempotency(
    accountId,
    "welcome",
    accountId,
  );
  const account = await getAccount(accountId);
  if (account.welcomeGranted || existingIdemp) {
    if (!account.welcomeGranted && existingIdemp) {
      // Ledger says granted but flag missing — heal flag without adding credit
      const healed = {
        ...account,
        welcomeGranted: true,
        updatedAt: new Date().toISOString(),
      };
      await saveAccount(healed);
      return healed;
    }
    return account;
  }

  const entryId = newLedgerId("welcome");
  // Mark idempotency BEFORE mutating balance to block cookie-farm / parallel races
  await saveLedgerIdempotency(accountId, "welcome", accountId, entryId);

  const next: CreditAccount = {
    ...account,
    credits: account.credits + 1,
    welcomeGranted: true,
    updatedAt: new Date().toISOString(),
  };
  await saveAccount(next);
  await appendLedgerEntry({
    id: entryId,
    accountId,
    type: "welcome",
    creditDelta: 1,
    reason: "login_welcome_once",
    createdAt: new Date().toISOString(),
  });
  return next;
}

export function hasAccess(account: CreditAccount): boolean {
  if (
    account.subscriptionEndsAt &&
    new Date(account.subscriptionEndsAt).getTime() > Date.now()
  ) {
    return true;
  }
  return account.credits > 0;
}

function hasActiveSubscription(account: CreditAccount): boolean {
  return Boolean(
    account.subscriptionEndsAt &&
      new Date(account.subscriptionEndsAt).getTime() > Date.now(),
  );
}

/** Only call AFTER successful generation — failures must not deduct. */
export function consumeCredit(account: CreditAccount): CreditAccount {
  if (hasActiveSubscription(account)) {
    return { ...account, updatedAt: new Date().toISOString() };
  }
  return {
    ...account,
    credits: Math.max(0, account.credits - 1),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deduct-after-success with ledger + clientRequestId idempotency.
 * Replaying the same clientRequestId does not double-charge.
 */
export async function consumeCreditAfterSuccess(
  account: CreditAccount,
  clientRequestId?: string | null,
): Promise<CreditAccount> {
  if (clientRequestId) {
    const prior = await getLedgerIdempotency(
      account.id,
      "consume",
      clientRequestId,
    );
    if (prior) {
      // Already consumed for this request — return current persisted balance
      return getAccount(account.id);
    }
  }

  const next = consumeCredit(account);
  const entryId = newLedgerId("consume");
  const delta = hasActiveSubscription(account)
    ? 0
    : next.credits - account.credits; // typically -1

  await saveAccount(next);
  if (clientRequestId) {
    await saveLedgerIdempotency(
      account.id,
      "consume",
      clientRequestId,
      entryId,
    );
  }
  await appendLedgerEntry({
    id: entryId,
    accountId: account.id,
    type: "consume",
    creditDelta: delta,
    clientRequestId: clientRequestId || undefined,
    reason: hasActiveSubscription(account)
      ? "subscription_unlimited"
      : "generate_success",
    createdAt: new Date().toISOString(),
  });
  return next;
}

/**
 * Refund a prior consume (e.g. rare post-deduct failure path).
 * Idempotent when clientRequestId is provided (refund:<id>).
 */
export async function refundCredit(
  accountId: string,
  options: {
    amount?: number;
    clientRequestId?: string | null;
    reason?: string;
  } = {},
): Promise<CreditAccount> {
  const amount = Math.max(1, options.amount ?? 1);
  const account = await getAccount(accountId);

  if (options.clientRequestId) {
    const refundKey = `refund:${options.clientRequestId}`;
    const prior = await getLedgerIdempotency(accountId, "consume", refundKey);
    if (prior) return account;
  }

  // Active subscription did not spend a credit unit — nothing to refund
  if (hasActiveSubscription(account) && !options.amount) {
    return account;
  }

  const next: CreditAccount = {
    ...account,
    credits: account.credits + amount,
    updatedAt: new Date().toISOString(),
  };
  const entryId = newLedgerId("refund");
  await saveAccount(next);
  if (options.clientRequestId) {
    await saveLedgerIdempotency(
      accountId,
      "consume",
      `refund:${options.clientRequestId}`,
      entryId,
    );
  }
  await appendLedgerEntry({
    id: entryId,
    accountId,
    type: "refund",
    creditDelta: amount,
    clientRequestId: options.clientRequestId || undefined,
    reason: options.reason || "generate_failure_refund",
    createdAt: new Date().toISOString(),
  });
  return next;
}

export function applyGrant(
  account: CreditAccount,
  grant: { credits: number; subscriptionDays: number },
): CreditAccount {
  const next = { ...account, updatedAt: new Date().toISOString() };
  if (grant.subscriptionDays > 0) {
    const base = Math.max(
      Date.now(),
      account.subscriptionEndsAt
        ? new Date(account.subscriptionEndsAt).getTime()
        : 0,
    );
    next.subscriptionEndsAt = new Date(
      base + grant.subscriptionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }
  if (grant.credits > 0) {
    next.credits = account.credits + grant.credits;
  }
  return next;
}

export type FulfillPaidResult = {
  ok: boolean;
  alreadyFulfilled?: boolean;
  account: CreditAccount;
  code?: string;
  error?: string;
};

/**
 * Apply paid entitlements ONLY after a verified payment success callback.
 * Never call from client `?paid=1` return URLs — paymentId must be unique
 * per successful trade (MerchantTradeNo / hub payment id).
 */
export async function fulfillPaidPlan(input: {
  accountId: string;
  planId: string;
  paymentId: string;
}): Promise<FulfillPaidResult> {
  const accountId = (input.accountId || "").trim();
  const planId = (input.planId || "").trim();
  const paymentId = (input.paymentId || "").trim();

  if (!accountId || isGuestAccountId(accountId)) {
    return {
      ok: false,
      account: emptyAccount(accountId || "guest", 0),
      code: "GUEST_NOT_ELIGIBLE",
      error: "付款入帳需登入 NovaOS 帳號",
    };
  }
  if (!paymentId) {
    return {
      ok: false,
      account: await getAccount(accountId),
      code: "MISSING_PAYMENT_ID",
      error: "缺少 paymentId，拒絕入帳",
    };
  }

  const grant = grantForPlan(planId);
  if (!grant) {
    return {
      ok: false,
      account: await getAccount(accountId),
      code: "INVALID_PLAN",
      error: "無效或免付費方案，無法以付款回調入帳",
    };
  }

  const existing = await getPaymentFulfill(paymentId);
  if (existing) {
    return {
      ok: true,
      alreadyFulfilled: true,
      account: await getAccount(accountId),
    };
  }

  const idemp = await getLedgerIdempotency(accountId, "payment", paymentId);
  if (idemp) {
    return {
      ok: true,
      alreadyFulfilled: true,
      account: await getAccount(accountId),
    };
  }

  const account = await getAccount(accountId);
  const next = applyGrant(account, grant);
  const entryId = newLedgerId("purchase");

  await saveLedgerIdempotency(accountId, "payment", paymentId, entryId);
  await saveAccount(next);
  await appendLedgerEntry({
    id: entryId,
    accountId,
    type: grant.subscriptionDays > 0 ? "subscription" : "purchase",
    creditDelta: grant.credits,
    paymentId,
    reason: `plan:${planId}`,
    createdAt: new Date().toISOString(),
  });
  await savePaymentFulfill({
    paymentId,
    accountId,
    planId,
    createdAt: new Date().toISOString(),
    creditsAfter: next.credits,
    subscriptionEndsAt: next.subscriptionEndsAt,
  });

  return { ok: true, account: next };
}
