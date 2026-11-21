import { NextResponse } from "next/server";
import {
  grantWelcomeCreditOnce,
  isGuestAccountId,
} from "@/lib/credits";

/**
 * One-time welcome credit for authenticated NovaOS accounts.
 * Guests / anonymous ids are rejected (0 free credits).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accountId?: string };
    const accountId = String(body.accountId || "").trim();

    if (!accountId || isGuestAccountId(accountId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "請先登入 NovaOS 帳號以領取贈送 Credit",
          code: "GUEST_NOT_ELIGIBLE",
          credits: 0,
        },
        { status: 401 },
      );
    }

    const account = await grantWelcomeCreditOnce(accountId);

    return NextResponse.json({
      ok: true,
      accountId: account.id,
      credits: account.credits,
      welcomeGranted: Boolean(account.welcomeGranted),
      subscriptionEndsAt: account.subscriptionEndsAt,
      message: account.welcomeGranted
        ? "登入贈 1 次 Credit 已入帳（每位帳號僅一次）"
        : undefined,
    });
  } catch (error) {
    console.error("welcome credit error", error);
    return NextResponse.json(
      { ok: false, error: "無法領取贈送 Credit", code: "WELCOME_FAILED" },
      { status: 500 },
    );
  }
}
