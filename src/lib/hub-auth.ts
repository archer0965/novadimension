import { getNovaOsLoginUrl, getNovaOsSignupUrl } from "@/lib/novaos-hub";

/** Redirect product auth to NovaOS hub; return via /auth/receive after login. */
export function hubAuthRedirect(
  mode: "login" | "signup",
  nextPath = "/"
): string {
  return mode === "signup"
    ? getNovaOsSignupUrl(nextPath)
    : getNovaOsLoginUrl(nextPath);
}
