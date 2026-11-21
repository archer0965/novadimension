import { put, list } from "@vercel/blob";

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
  const guest = isGuestAccountId(id);

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
      return emptyAccount(id, guest ? 0 : 0);
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
 */
export async function grantWelcomeCreditOnce(
  accountId: string,
): Promise<CreditAccount> {
  if (isGuestAccountId(accountId)) {
    return emptyAccount(accountId, 0);
  }

  const account = await getAccount(accountId);
  if (account.welcomeGranted) {
    return account;
  }

  const next: CreditAccount = {
    ...account,
    credits: account.credits + 1,
    welcomeGranted: true,
    updatedAt: new Date().toISOString(),
  };
  await saveAccount(next);
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

/** Only call AFTER successful generation — failures must not deduct. */
export function consumeCredit(account: CreditAccount): CreditAccount {
  if (
    account.subscriptionEndsAt &&
    new Date(account.subscriptionEndsAt).getTime() > Date.now()
  ) {
    return { ...account, updatedAt: new Date().toISOString() };
  }
  return {
    ...account,
    credits: Math.max(0, account.credits - 1),
    updatedAt: new Date().toISOString(),
  };
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
