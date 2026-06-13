# Partial funding

Today every deal is funded in full by exactly one investor. We'll switch to multiple investors per deal, each taking a slice of the capital and a proportional slice of the equity. The SME controls fragmentation via a minimum ticket size.

## SME side
- New required field on the application: **Minimum investment (€)**, must be ≤ amount requested. Defaults to 25% of amount requested.
- SME status page shows funding progress: € raised / € requested, % equity allocated, list of investors with their ticket + equity %, and per-investor confirmation toggles (replaces the single "confirm equity issued" button).

## Investor side
- Marketplace: each deal card shows a progress bar (raised vs. requested) and "Min ticket €X". Deals stay listed until fully funded.
- Deal detail: investor picks an amount between min ticket and remaining capacity. UI shows equity they'll receive = `amount / total_amount_requested * total_equity_offered`. "Fund €X into escrow" button debits wallet, creates an investment row, advances deal to `partially_funded` (or `fully_funded` when raised == requested).
- Portfolio: one row per investment (not per deal). Each shows the slice's amount, equity %, status, and confirmations.
- Escrow room: per-investment, same 5-stage tracker.

## Admin side
- Deals page: progress bar now reflects € raised, with a sub-list of investments per deal and their individual escrow stages.
- Disputes: still per-investment.

## State model
A deal moves: `under_review → approved → partially_funded → fully_funded → completed` (or `disputed` / `rejected`). Each **investment** has its own lifecycle: `funds_in_escrow → equity_confirmed → completed` / `disputed`, gated by SME confirming that investor's equity and the investor confirming receipt.

A deal reaches `completed` when every investment is `completed`. The deal can be `fully_funded` (capital fully raised) before all equity confirmations are done.

## Technical details

**Schema (new migration):**
- Add `deals.min_investment numeric not null default 0` and `deals.funded_amount numeric not null default 0`. Keep `amount_requested`, `equity_offered`. Remove single-investor fields from active use: `investor_id`, `sme_confirmed_equity`, `investor_confirmed_receipt`, `funded_at`, `deadline`, `platform_fee` move to the new investments table. (Keep columns for back-compat but stop reading them.)
- Extend `deal_status` enum with `partially_funded` and `fully_funded`.
- New table `public.investments`:
  - `id`, `deal_id` (fk deals), `investor_id` (fk auth.users), `amount numeric`, `equity_percent numeric` (computed at insert: amount/amount_requested*equity_offered), `status` enum (`funds_in_escrow`, `equity_confirmed`, `completed`, `disputed`), `sme_confirmed_equity bool`, `investor_confirmed_receipt bool`, `funded_at`, `deadline`, `platform_fee numeric`, `dispute_reason text`, timestamps.
- GRANTs to authenticated + service_role.
- RLS: SME of the parent deal can read all investments on their deals + update confirmations; investor can read/update their own; admin all.
- Trigger `after insert on investments`: increment `deals.funded_amount`, set deal status to `partially_funded` if `< amount_requested` else `fully_funded`.
- Trigger validates `amount >= deals.min_investment` and `funded_amount + amount <= amount_requested`.

**Frontend:**
- `sme.apply.tsx`: add Min investment input.
- `investor.index.tsx`: progress bar + min ticket, filter deals where `funded_amount < amount_requested`.
- `investor.deal.$id.tsx`: amount input (slider + numeric), live equity calc, atomic insert into `investments` + wallet debit. Redirect to room for that investment.
- `investor.room.$id.tsx`: route param is now investment id; load investment + parent deal.
- `investor.portfolio.tsx`: list investments.
- `sme.status.tsx`: progress + per-investment confirmation rows.
- `admin.deals.tsx`: progress = funded_amount/amount_requested; expandable list of investments per deal.
- `admin.disputes.tsx`: query investments where status=disputed.

**Scope kept:** still no real payments, no KYC. SME still sets equity_offered up front; each investor's slice is strictly proportional (no per-investor negotiation).
