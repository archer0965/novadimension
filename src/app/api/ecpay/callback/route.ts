import { NextResponse } from "next/server";

/**
 * 綠界付款成功通知已統一由拓新雲端主站處理：
 * https://paycheck.com.de/api/checkout/callback
 *
 * Paid credits MUST be granted only via authenticated
 * POST /api/credits/fulfill after payment success.
 * Client return URLs (?paid=1) never grant credits.
 *
 * 本路由僅保留相容／說明用途，避免誤設 ReturnURL 到子站後被未驗證請求入帳。
 */
export async function POST() {
  return new NextResponse(
    "0|UseNovaOsHubCallback — configure ECPay ReturnURL to paycheck.com.de/api/checkout/callback; hub must then POST /api/credits/fulfill with CREDITS_FULFILL_SECRET. Client ?paid=1 never grants credits.",
    {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    message:
      "付費 Credit 僅在付款成功回調後入帳。請使用主站 /api/checkout/callback，並由 hub 以共享密鑰呼叫本站 /api/credits/fulfill。前端 ?paid=1 不會加點。",
    fulfill: "/api/credits/fulfill",
    hubCallback: "https://paycheck.com.de/api/checkout/callback",
  });
}
