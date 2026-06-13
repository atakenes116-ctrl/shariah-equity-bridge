export type MurabahaTier = { months: number; profitRate: number; label: string };

export const MURABAHA_TIERS: MurabahaTier[] = [
  { months: 6,  profitRate: 0.04, label: "6 months · 4%" },
  { months: 12, profitRate: 0.08, label: "12 months · 8%" },
  { months: 18, profitRate: 0.11, label: "18 months · 11%" },
  { months: 24, profitRate: 0.14, label: "24 months · 14%" },
  { months: 36, profitRate: 0.20, label: "36 months · 20%" },
];

export function tierFor(months: number): MurabahaTier | undefined {
  return MURABAHA_TIERS.find((t) => t.months === months);
}

export function computeMurabaha(cost: number, months: number) {
  const t = tierFor(months);
  const rate = t?.profitRate ?? 0;
  const profit = cost * rate;
  const total = cost + profit;
  const monthly = months > 0 ? total / months : 0;
  return { profit, total, monthly, rate };
}

export function investorMonthly(invAmount: number, dealCost: number, dealMonths: number) {
  if (!dealCost) return { monthly: 0, totalReceive: 0, profit: 0 };
  const share = invAmount / dealCost;
  const { total, monthly, profit } = computeMurabaha(dealCost, dealMonths);
  return {
    monthly: monthly * share,
    totalReceive: total * share,
    profit: profit * share,
  };
}