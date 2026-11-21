import { SITE_URL } from "@/lib/site";

/** 拓新雲端主站（統一綠界金流入口） */
export const NOVAOS_HUB_URL =
  process.env.NEXT_PUBLIC_NOVAOS_URL?.replace(/\/$/, "") ||
  "https://paycheck.com.de";

export const NOVAOS_LEGAL_URL = `${NOVAOS_HUB_URL}/legal`;

export const NOVAOS_BILLING_PATH = "/dashboard/pass#upgrade";

const DEFAULT_RETURN_TO = `${SITE_URL}/`;

/**
 * 付費升級：導向主站登入 → 訂閱中控（綠界 ECPay）
 * 與 DocMate／NovaStore 同一金流與帳號體系。
 */
export function getNovaOsCheckoutUrl(options?: {
  planId?: string;
  returnTo?: string;
}): string {
  const next = encodeURIComponent(NOVAOS_BILLING_PATH);
  let url = `${NOVAOS_HUB_URL}/login?next=${next}&product=novadimension`;
  if (options?.planId) {
    url += `&plan=${encodeURIComponent(options.planId)}`;
  }
  if (options?.returnTo) {
    url += `&return_to=${encodeURIComponent(options.returnTo)}`;
  }
  return url;
}

export function getNovaOsUpgradeUrl(): string {
  return getNovaOsCheckoutUrl();
}

/** Unified auth entry — always NovaOS hub login. */
export function getNovaOsLoginUrl(returnTo = DEFAULT_RETURN_TO): string {
  return `${NOVAOS_HUB_URL}/login?next=${encodeURIComponent(returnTo)}&product=novadimension`;
}

export function getNovaOsSignupUrl(returnTo = DEFAULT_RETURN_TO): string {
  return `${NOVAOS_HUB_URL}/signup?next=${encodeURIComponent(returnTo)}&product=novadimension`;
}
