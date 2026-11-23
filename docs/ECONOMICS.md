# NovaDimension — fal.ai cost & gross margin (internal)

Read-only analytics. **Do not change official list prices or plan entitlements from this doc.**

## Unit cost

| Item | Value |
|------|-------|
| Model | `fal-ai/flux/dev/image-to-image` |
| Published rate | **USD $0.03 / megapixel** (rounded up) |
| Assumed output | 1 MP (~1024×1024) |
| FX (estimate) | 1 USD ≈ 32 TWD |
| **Cost / generation** | **≈ USD $0.03 ≈ NT$ 0.96** |

Source: https://fal.ai/models/fal-ai/flux/dev/image-to-image

Live table: admin `/admin` →「fal.ai 成本／毛利估算」or `src/lib/economics.ts` → `buildEconomicsSnapshot()`.

## Primary margin table (assumed usage)

| Plan | List price (TWD) | Assumed gens | fal cost (TWD) | Gross margin | Break-even gens |
|------|------------------|--------------|----------------|--------------|-----------------|
| 免費體驗 | 0 | 1 | ~1 | n/a (CAC) | — |
| 單張體驗 | 39 | 1 | ~1 | ~97.5% | 1 |
| 尊榮月繳 | 299 | 60 | ~58 | ~80.7% | ~311 |
| 半年方案 | 1614 | 360 | ~346 | ~78.6% | ~1681 |
| 年繳方案 | 3049 | 720 | ~691 | ~77.3% | ~3176 |

Assumptions are internal only (light personal use). Unlimited plans have **no hard cap**.

## Unlimited abuse risk

At ~50 gens/day (~1500/month), monthly plan fal cost ≈ NT$1,440 vs NT$299 revenue → **deeply negative margin**. Mitigations to consider later (not price changes): per-day soft cap, anomaly rate alerts, or high-credit packs instead of true unlimited.

## Code

- `src/lib/economics.ts` — snapshot builder
- `src/app/api/admin/economics/route.ts` — admin JSON
- Official prices remain in `src/lib/constants.ts` (`PRICING_PLANS`) untouched by economics.
