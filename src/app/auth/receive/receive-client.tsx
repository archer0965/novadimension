"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NOVAOS_HUB_URL, toReceiveReturnUrl } from "@/lib/novaos-hub";

function sanitizeNext(raw: string | null, fallback = "/") {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/**
 * Hub returns here with #access_token&refresh_token after login.
 * Clear the hash and restore the original path (return-to-origin).
 */
export function AuthReceiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("正在完成登入…");

  useEffect(() => {
    const next = sanitizeNext(searchParams.get("next"));
    const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
    const hasTokens = hash.includes("access_token");

    if (hasTokens) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      router.replace(next);
      return;
    }

    setMessage("登入狀態未帶入，改導向拓新雲端…");
    const returnTo = toReceiveReturnUrl(next);
    window.location.replace(
      `${NOVAOS_HUB_URL}/login?next=${encodeURIComponent(returnTo)}&product=novadimension`
    );
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 text-ink-muted">
      <p className="text-sm">{message}</p>
    </main>
  );
}
