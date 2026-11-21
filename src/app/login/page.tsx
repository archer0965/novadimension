import { redirect } from "next/navigation";
import { getNovaOsLoginUrl } from "@/lib/novaos-hub";

export const metadata = { title: "登入｜拓維空間" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : "/";
  redirect(getNovaOsLoginUrl(next));
}
