"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  accountIdFromAccessToken,
  setAccountId,
} from "@/lib/account-client";
import { NOVAOS_HUB_URL, toReceiveReturnUrl } from "@/lib/novaos-hub";

function sanitizeNext(raw: string | null, fallback = "/") {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

function readAccessTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return params.get("access_token");
}

/**
 * Hub returns here with #access_token&refresh_token after login.
 * Bind account id, claim one-time welcome credit, then restore path.
 */
export function AuthReceiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("正在完成登入…");

  useEffect(() => {
    const next = sanitizeNext(searchParams.get("next"));
    const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
    const accessToken = readAccessTokenFromHash(hash);
    const hasTokens = Boolean(accessToken) || hash.includes("access_token");

    async function finishLogin() {
      if (accessToken) {
        const accountId = accountIdFromAccessToken(accessToken);
        if (accountId) {
          setAccountId(accountId, true);
          try {
            await fetch("/api/credits/welcome", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accountId }),
            });
          } catch {
            // Non-blocking — user can still use purchased credits
          }
        }
      }

      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      router.replace(next);
    }

    if (hasTokens) {
      void finishLogin();
      return;
    }

    setMessage("登入狀態未帶入，改導向拓新雲端…");
    const returnTo = toReceiveReturnUrl(next);
    window.location.replace(
      `${NOVAOS_HUB_URL}/login?next=${encodeURIComponent(returnTo)}&product=novadimension`,
    );
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 text-ink-muted">
      <p className="text-sm">{message}</p>
    </main>
  );
}
