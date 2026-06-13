# Halal Capital — Shariah-Compliant SME Financing

A demo marketplace that matches one SME seeking capital with one investor who funds it in exchange for equity. The platform acts as an escrow arbiter. Built as a clean, modern, trustworthy fintech prototype.

## Stack

- **Frontend:** React 19 + TanStack Start (Vite 7), Tailwind v4, shadcn/ui
- **Backend:** Lovable Cloud (Postgres, Auth, Storage, RLS)
- **Server logic:** TanStack `createServerFn`
- **Styling:** Light theme, emerald/teal accent

## Roles

- **SME** — submits one application, uploads bank & financial statements, confirms equity transfer.
- **Investor** — browses approved deals, funds one at a time via escrow, confirms equity received.
- **Admin** — reviews Shariah screening flags, approves/rejects deals, resolves disputes, releases funds.

## Shariah Screening (`src/lib/screening.ts`)

Advisory flags computed on every deal:

- Prohibited sector list (alcohol, gambling, conventional finance, pork, adult, tobacco, weapons)
- Interest-bearing debt / total assets ≤ 33%
- Interest income / revenue ≤ 5%
- Minimum €25k revenue and 1 year operating history
- Implied valuation ≤ 15× annual revenue
- Document and field completeness

## Escrow State Machine

`under_review` → `approved` → `funds_in_escrow` → `equity_confirmed` → `completed`

A 3% platform fee is taken on final release. Disputes can be raised at any escrow stage and routed to admin.

## Getting Started

1. Open the app — the landing page hosts sign-in, sign-up, and a **Seed demo data** button.
2. Click **Seed demo data** to create the demo accounts and two sample deals (one clean, one flagged).
3. Sign in with one of the demo accounts below.

### Demo Accounts (password: `demo1234`)

| Role     | Email                | Use for                                          |
| -------- | -------------------- | ------------------------------------------------ |
| SME      | `sme@demo.app`       | Submit application, confirm equity transfer      |
| Investor | `investor@demo.app`  | Browse marketplace, fund a deal (€500k wallet)   |
| Admin    | `admin@demo.app`     | Review queue, approve/reject, resolve disputes   |

## Routes

- `/` — landing + auth
- `/sme`, `/sme/apply`, `/sme/status` — SME workspace (desktop-friendly)
- `/investor`, `/investor/portfolio`, `/investor/deal/$id`, `/investor/room/$id` — investor PWA (mobile-first)
- `/admin`, `/admin/disputes` — admin console

## Scope Limits

No real payments, no KYC, no document verification, no syndication (strictly one investor per deal). Prototype only.
