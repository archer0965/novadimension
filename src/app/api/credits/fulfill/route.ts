import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { fulfillPaidPlan } from "@/lib/credits";
import { reportToHub } from "@/lib/novaos-telemetry";

/**
 * Paid Credit / subscription unlock — ONLY after payment success callback.
 *
 * Called by NovaOS hub (or ECPay bridge) with a shared secret.
 * Client return URLs like `?paid=1` must NEVER hit this without a real paymentId.
 *
 * Auth: Authorization: Bearer <CREDITS_FULFILL_SECRET>
 *    or  X-NovaOS-Signature: hex(hmac_sha256(rawBody, secret))
 */

function fulfillSecret(): string | null {
  const s =
    process.env.CREDITS_FULFILL_SECRET?.trim() ||
    process.env.NOVAOS_FULFILL_SECRET?.trim() ||
    null;
  return s || null;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function authorize(request: Request, rawBody: string): boolean {
  const secret = fulfillSecret();
  if (!secret) return false;

  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ") && bearer.slice(7) === secret) {
    return true;
  }

  const sig = request.headers.get("x-novaos-signature") || "";
  if (sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqualHex(sig, expected);
  }

  return false;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!fulfillSecret()) {
    return NextResponse.json(
      {
        ok: false,
        error: "伺服器未設定 CREDITS_FULFILL_SECRET",
        code: "NO_FULFILL_SECRET",
      },
      { status: 503 },
    );
  }

  if (!authorize(request, rawBody)) {
    await reportToHub({
      kind: "payment_failure",
      severity: "warn",
      message: "credits/fulfill unauthorized",
    });
    return NextResponse.json(
      { ok: false, error: "未授權", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: {
    accountId?: string;
    planId?: string;
    paymentId?: string;
    /** Must be true / "1" / success — reject pending or failed */
    paymentStatus?: string;
    success?: boolean;
  };

  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "無效 JSON", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const status = String(body.paymentStatus || "").toLowerCase();
  const successFlag =
    body.success === true ||
    status === "success" ||
    status === "paid" ||
    status === "1";

  if (!successFlag) {
    return NextResponse.json(
      {
        ok: false,
        error: "僅接受付款成功回調；未成功付款不會入帳",
        code: "PAYMENT_NOT_SUCCESS",
      },
      { status: 400 },
    );
  }

  const result = await fulfillPaidPlan({
    accountId: String(body.accountId || ""),
    planId: String(body.planId || ""),
    paymentId: String(body.paymentId || ""),
  });

  if (!result.ok) {
    await reportToHub({
      kind: "payment_failure",
      severity: "error",
      message: result.error || result.code || "fulfill_failed",
      meta: { planId: body.planId, paymentId: body.paymentId },
    });
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        code: result.code,
        credits: result.account.credits,
      },
      { status: 400 },
    );
  }

  await reportToHub({
    kind: "payment_success",
    severity: "info",
    message: result.alreadyFulfilled
      ? "fulfill_idempotent_replay"
      : "credits_fulfilled",
    meta: {
      planId: body.planId,
      paymentId: body.paymentId,
      accountId: body.accountId,
    },
  });

  return NextResponse.json({
    ok: true,
    alreadyFulfilled: Boolean(result.alreadyFulfilled),
    accountId: result.account.id,
    credits: result.account.credits,
    subscriptionEndsAt: result.account.subscriptionEndsAt,
    message: result.alreadyFulfilled
      ? "此付款已入帳（冪等）"
      : "付款成功，Credit／訂閱已入帳",
  });
}

/** Reject naive GET / query-param grants (`?paid=1` must not unlock). */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "付費 Credit 僅能透過付款成功回調 POST /api/credits/fulfill 入帳；前端 ?paid=1 不會加點。",
      code: "METHOD_NOT_ALLOWED",
    },
    { status: 405 },
  );
}
