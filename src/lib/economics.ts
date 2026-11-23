/**
 * Internal fal.ai cost / gross-margin estimates for NovaDimension plans.
 * READ-ONLY analytics — does not change official prices or entitlements.
 *
 * Source (fal.ai Model APIs, flux/dev/image-to-image):
 *   https://fal.ai/models/fal-ai/flux/dev/image-to-image
 *   billed at ~USD $0.03 per megapixel (rounded up).
 */

import { PRICING_PLANS, type PricingPlanId } from "@/lib/constants";

/** Default model used by fal-generate.ts */
export const FAL_MODEL_DEFAULT = "fal-ai/flux/dev/image-to-image";

/** Published fal rate for flux/dev/image-to-image (USD / megapixel). */
export const FAL_USD_PER_MEGAPIXEL = 0.03;

/**
 * Typical output size for interior img2img (~1024×1024 → 1 MP).
 * Higher-res uploads bill more (rounded up per MP).
 */
export const ASSUMED_OUTPUT_MEGAPIXELS = 1;

/** FX used only for internal margin math (not customer pricing). */
export const USD_TO_TWD_ESTIMATE = 32;

export type MarginScenarioId =
  | "break_even"
  | "light"
  | "moderate"
  | "heavy"
  | "abuse";

export type PlanEconomicsRow = {
  planId: PricingPlanId;
  planName: string;
  /** Official list price in TWD — mirrored from PRICING_PLANS, never mutated here */
  listPriceTwd: number;
  period: string;
  billingKind: "free_credit" | "one_shot" | "unlimited_subscription";
  /** Assumed generations in the billing window for margin math */
  assumedGenerations: number;
  falCostUsd: number;
  falCostTwd: number;
  /** (revenue − falCost) / revenue; null when revenue is 0 */
  grossMarginPct: number | null;
  /** revenue − falCost (TWD) */
  grossProfitTwd: number;
  /** Generations at which fal cost equals list price (∞ plans only) */
  breakEvenGenerations: number | null;
  notes: string;
};

export type EconomicsSnapshot = {
  computedAt: string;
  falModel: string;
  falUsdPerMegapixel: number;
  assumedMegapixels: number;
  usdToTwd: number;
  costPerGenerationUsd: number;
  costPerGenerationTwd: number;
  unlimitedAbuseRisk: string;
  rows: PlanEconomicsRow[];
  scenarios: Array<{
    id: MarginScenarioId;
    label: string;
    generationsPerMonth: number;
  }>;
  scenarioMargins: Array<{
    planId: PricingPlanId;
    scenarioId: MarginScenarioId;
    generations: number;
    falCostTwd: number;
    grossMarginPct: number | null;
    grossProfitTwd: number;
  }>;
};

export function costPerGenerationUsd(
  megapixels = ASSUMED_OUTPUT_MEGAPIXELS,
  usdPerMp = FAL_USD_PER_MEGAPIXEL,
): number {
  const mp = Math.max(1, Math.ceil(megapixels));
  return mp * usdPerMp;
}

export function costPerGenerationTwd(
  megapixels = ASSUMED_OUTPUT_MEGAPIXELS,
  usdPerMp = FAL_USD_PER_MEGAPIXEL,
  fx = USD_TO_TWD_ESTIMATE,
): number {
  return costPerGenerationUsd(megapixels, usdPerMp) * fx;
}

function marginPct(revenue: number, cost: number): number | null {
  if (revenue <= 0) return null;
  return ((revenue - cost) / revenue) * 100;
}

function planBillingKind(
  id: PricingPlanId,
): PlanEconomicsRow["billingKind"] {
  if (id === "free") return "free_credit";
  if (id === "single") return "one_shot";
  return "unlimited_subscription";
}

/** Default generation assumptions for the primary margin table (internal only). */
const DEFAULT_ASSUMED_GENS: Record<PricingPlanId, number> = {
  free: 1,
  single: 1,
  /** Light personal use — not a promise of cap */
  monthly: 60,
  halfyear: 360,
  yearly: 720,
};

const SCENARIOS: EconomicsSnapshot["scenarios"] = [
  { id: "break_even", label: "損益兩平用量", generationsPerMonth: 0 },
  { id: "light", label: "輕度（~2／日）", generationsPerMonth: 60 },
  { id: "moderate", label: "中度（~5／日）", generationsPerMonth: 150 },
  { id: "heavy", label: "重度（~15／日）", generationsPerMonth: 450 },
  {
    id: "abuse",
    label: "濫用風險（~50／日）",
    generationsPerMonth: 1500,
  },
];

function subscriptionMonths(planId: PricingPlanId): number {
  if (planId === "monthly") return 1;
  if (planId === "halfyear") return 6;
  if (planId === "yearly") return 12;
  return 0;
}

/**
 * Build the internal gross-margin table. Prices are read from PRICING_PLANS
 * (display only) — this module must never write back into pricing.
 */
export function buildEconomicsSnapshot(options?: {
  megapixels?: number;
  usdPerMp?: number;
  fx?: number;
}): EconomicsSnapshot {
  const megapixels = options?.megapixels ?? ASSUMED_OUTPUT_MEGAPIXELS;
  const usdPerMp = options?.usdPerMp ?? FAL_USD_PER_MEGAPIXEL;
  const fx = options?.fx ?? USD_TO_TWD_ESTIMATE;
  const unitUsd = costPerGenerationUsd(megapixels, usdPerMp);
  const unitTwd = unitUsd * fx;

  const rows: PlanEconomicsRow[] = PRICING_PLANS.map((plan) => {
    const assumed = DEFAULT_ASSUMED_GENS[plan.id];
    const falCostTwd = assumed * unitTwd;
    const falCostUsd = assumed * unitUsd;
    const revenue = plan.price;
    const breakEven =
      planBillingKind(plan.id) === "unlimited_subscription" && unitTwd > 0
        ? Math.floor(revenue / unitTwd)
        : plan.id === "single"
          ? 1
          : null;

    let notes = "";
    if (plan.id === "free") {
      notes = "登入贈 1 次；每成功生成約虧 fal 成本（獲客／體驗）。";
    } else if (plan.id === "single") {
      notes = "單次計價；單位經濟健康，但無訂閱槓桿。";
    } else {
      notes = `無限方案以假設 ${assumed} 次／週期估算；超過損益兩平（約 ${breakEven} 次）後毛利轉負。`;
    }

    return {
      planId: plan.id,
      planName: plan.name,
      listPriceTwd: plan.price,
      period: plan.period,
      billingKind: planBillingKind(plan.id),
      assumedGenerations: assumed,
      falCostUsd,
      falCostTwd,
      grossMarginPct: marginPct(revenue, falCostTwd),
      grossProfitTwd: revenue - falCostTwd,
      breakEvenGenerations: breakEven,
      notes,
    };
  });

  const scenarioMargins: EconomicsSnapshot["scenarioMargins"] = [];
  for (const plan of PRICING_PLANS) {
    if (planBillingKind(plan.id) !== "unlimited_subscription") continue;
    const months = subscriptionMonths(plan.id);
    for (const scenario of SCENARIOS) {
      const gens =
        scenario.id === "break_even"
          ? unitTwd > 0
            ? Math.floor(plan.price / unitTwd)
            : 0
          : scenario.generationsPerMonth * months;
      const falCostTwd = gens * unitTwd;
      scenarioMargins.push({
        planId: plan.id,
        scenarioId: scenario.id,
        generations: gens,
        falCostTwd,
        grossMarginPct: marginPct(plan.price, falCostTwd),
        grossProfitTwd: plan.price - falCostTwd,
      });
    }
  }

  return {
    computedAt: new Date().toISOString(),
    falModel: FAL_MODEL_DEFAULT,
    falUsdPerMegapixel: usdPerMp,
    assumedMegapixels: megapixels,
    usdToTwd: fx,
    costPerGenerationUsd: unitUsd,
    costPerGenerationTwd: unitTwd,
    unlimitedAbuseRisk:
      "無限月／半年／年繳無每帳號生成上限時，單一濫用帳號即可在重度用量下把毛利打穿；" +
      "建議後續加 per-day soft cap、異常速率告警、或改為高額 Credit 包。本表僅估算，不調整售價。",
    rows,
    scenarios: SCENARIOS,
    scenarioMargins,
  };
}

export function formatMarginPct(value: number | null): string {
  if (value === null) return "n/a（收入 0）";
  const sign = value < 0 ? "" : "";
  return `${sign}${value.toFixed(1)}%`;
}
