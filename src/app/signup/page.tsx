import { redirect } from "next/navigation";
import { getNovaOsSignupUrl } from "@/lib/novaos-hub";

export const metadata = { title: "註冊｜拓維空間" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : "/";
  redirect(getNovaOsSignupUrl(next));
}
