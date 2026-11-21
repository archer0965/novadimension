import { Suspense } from "react";
import { AuthReceiveClient } from "./receive-client";

export default function AuthReceivePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 text-ink-muted">
          <p className="text-sm">正在完成登入…</p>
        </main>
      }
    >
      <AuthReceiveClient />
    </Suspense>
  );
}
