
## Goal

The SME picks a deal type when applying:

- **Musharakah** (existing) — equity, profit/loss share.
- **Murabaha** (new) — platform buys an asset, SME repays cost + fixed profit in equal monthly installments. No equity changes hands.

Investors can co-fund a Murabaha deal pro-rata (same partial-funding model as equity). Each investor receives their proportional slice of every installment.

## Profit tiers (platform-defined, fixed)

| Tenor | Total profit on cost |
|-------|----------------------|
| 6 months | 4% |
| 12 months | 8% |
| 18 months | 11% |
| 24 months | 14% |
| 36 months | 20% |

SME just picks a tenor; the markup is computed automatically. Tiers live in one config file so they're easy to tune.

## SME flow

On `sme/apply`, a **deal type** toggle at the top:

- *Equity (Musharakah)* — existing form.
- *Asset finance (Murabaha)* — replaces the equity fields with:
  - Asset name + short description
  - Supplier name
  - Asset cost (€) → this becomes `amount_requested`
  - Repayment tenor (dropdown of allowed tiers)
  - Min investor ticket
  - Use of funds + pitch (reused)
  - Financials (reused, for screening)

Computed and shown live: total profit, total repayable, monthly installment.

On `sme/status`, Murabaha deals show the funding progress + (once fully funded and equity-confirmation analog passes) an **installment schedule** with a "Mark this month paid" button per row. Each payment splits pro-rata to investors.

## Investor flow

- Marketplace card shows a **type badge** (Equity / Murabaha) and the relevant headline: equity % for Musharakah, "X% over N months" for Murabaha.
- Deal detail page swaps the lower section based on type:
  - Murabaha: amount slider → live "your monthly receivable" + total profit + simple repayment preview.
  - Murabaha investments still create rows in `investments`, but with no equity_percent (uses `share_percent` of installments instead).
- Portfolio lists both types; Murabaha rows show next installment date and amount received so far.

## Admin flow

- Review queue: Murabaha deals get an asset-finance screen (asset present? cost reasonable? tenor allowed?) alongside existing screens. Sector/financial Shariah screens still apply.
- Investments dashboard: progress bar for funding + a second progress bar for repayment (installments paid / total).
- Disputes: unchanged, plus a "missed installment" reason.

## Repayment mechanics (kept demo-grade)

- When a Murabaha deal becomes `fully_funded`, generate `installments` rows: one per month, with `due_date`, `total_amount`, `status='due'`.
- "Mark paid" button (SME side, demo) flips an installment to `paid`, debits a small notional from SME's wallet, credits each investor's wallet pro-rata. Real payments stay out of scope.
- When all installments are `paid`, deal status → `completed`.

## Technical changes

**DB migration**
- `deals.deal_type enum('musharakah','murabaha')` default `'musharakah'`.
- Murabaha-specific columns (nullable): `asset_name`, `asset_description`, `asset_supplier`, `tenor_months`, `profit_rate` (numeric), `total_repayable`.
- Loosen `equity_offered` to nullable (required only when `deal_type='musharakah'`).
- `investments.share_percent` (numeric) — pro-rata claim on installments (reuses existing equity_percent semantics but typed for both). Keep `equity_percent` populated for equity deals via the existing trigger.
- New `installments` table: `id`, `deal_id`, `seq`, `due_date`, `total_amount`, `status enum('due','paid','late')`, `paid_at`, timestamps. RLS: SME of the deal + admin + investors with a slice can read; only SME + admin can mark paid. GRANT block per the public-schema rule.
- Update `investments_before_insert` trigger: branch on `deal_type` (compute `share_percent` for both; `equity_percent` only when musharakah).
- New trigger `deals_after_status_change`: when Murabaha deal transitions to `fully_funded`, generate the `installments` rows.
- New trigger `installments_after_update`: when all paid, mark deal `completed`.

**Frontend**
- `src/lib/murabaha.ts` — tier table + helpers (`computeMurabaha(cost, tenor)` → {profit, total, monthly}).
- `sme/apply.tsx` — deal-type toggle and Murabaha sub-form.
- `sme/status.tsx` — repayment schedule UI for Murabaha deals.
- `investor/index.tsx` — type badge, dynamic headline.
- `investor/deal.$id.tsx` — Murabaha branch with monthly receivable preview.
- `investor/room.$id.tsx` and `investor/portfolio.tsx` — show installment progress for Murabaha investments.
- `admin/deals.tsx` — second progress bar (repayment) for Murabaha.
- Seed function: add one approved Murabaha example (e.g. "CNC machine for Barakah workshop, €40k over 12 months at 8%").

## Out of scope

- Real payments / payment rails.
- Late-fee logic, early settlement, partial installment payments.
- Secondary market / transfer of investor slices.
- Per-investor negotiated terms.
