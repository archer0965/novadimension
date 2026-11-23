import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { buildEconomicsSnapshot } from "@/lib/economics";

/** Admin-only read-only fal cost / margin analytics. */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const snapshot = buildEconomicsSnapshot();
  return NextResponse.json({ ok: true, economics: snapshot });
}
