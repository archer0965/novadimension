/**
 * Paid-plan entitlement grants applied ONLY after payment success callback.
 * Mirrors existing marketing entitlements — does NOT change official prices
 * or advertised credit / unlimited amounts.
 */

import type { PricingPlanId } from "@/lib/constants";

export type PlanGrant = {
  credits: number;
  subscriptionDays: number;
};

/**
 * Entitlement map (unchanged amounts):
 * - single → 1 Credit
 * - monthly / halfyear / yearly → unlimited via subscription window
 */
export const PLAN_GRANTS: Record<Exclude<PricingPlanId, "free">, PlanGrant> = {
  single: { credits: 1, subscriptionDays: 0 },
  monthly: { credits: 0, subscriptionDays: 30 },
  halfyear: { credits: 0, subscriptionDays: 183 },
  yearly: { credits: 0, subscriptionDays: 365 },
};

export function grantForPlan(planId: string): PlanGrant | null {
  if (planId === "free") return null;
  if (planId in PLAN_GRANTS) {
    return PLAN_GRANTS[planId as Exclude<PricingPlanId, "free">];
  }
  return null;
}
