import { NextResponse } from "next/server";
import { getAccount, isGuestAccountId } from "@/lib/credits";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = String(searchParams.get("accountId") || "guest");
  const account = await getAccount(accountId);

  return NextResponse.json({
    ok: true,
    accountId: account.id,
    guest: isGuestAccountId(accountId),
    credits: account.credits,
    subscriptionEndsAt: account.subscriptionEndsAt,
    welcomeGranted: Boolean(account.welcomeGranted),
  });
}
