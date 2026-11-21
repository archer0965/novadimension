import { NextResponse } from "next/server";
import {
  deleteGeneration,
  listGenerations,
} from "@/lib/generations-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = String(searchParams.get("accountId") || "").trim();

  if (!accountId || accountId === "guest") {
    return NextResponse.json({ ok: true, generations: [] });
  }

  const generations = await listGenerations(accountId);
  return NextResponse.json({ ok: true, generations });
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let accountId = String(searchParams.get("accountId") || "").trim();
    let id = String(searchParams.get("id") || "").trim();

    if (!accountId || !id) {
      try {
        const body = (await request.json()) as {
          accountId?: string;
          id?: string;
        };
        accountId = accountId || String(body.accountId || "").trim();
        id = id || String(body.id || "").trim();
      } catch {
        // no body
      }
    }

    if (!accountId || !id) {
      return NextResponse.json(
        { ok: false, error: "缺少 accountId 或 id", code: "MISSING_PARAMS" },
        { status: 400 },
      );
    }

    const deleted = await deleteGeneration(accountId, id);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error("delete generation error", error);
    return NextResponse.json(
      { ok: false, error: "刪除失敗", code: "DELETE_FAILED" },
      { status: 500 },
    );
  }
}
