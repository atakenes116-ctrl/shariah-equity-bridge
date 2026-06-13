export const PROHIBITED_SECTORS = [
  "Alcohol", "Gambling", "Conventional Finance", "Pork", "Adult Content", "Tobacco", "Weapons",
];

export const ALLOWED_SECTORS = [
  "Agriculture & Food", "Technology", "Healthcare", "Education", "Renewable Energy",
  "Logistics", "Manufacturing", "Retail", "Real Estate", "Professional Services",
  ...PROHIBITED_SECTORS,
];

export type Flag = { code: string; severity: "pass" | "warn"; label: string; detail: string };

export type DealLike = {
  sector: string;
  years_in_operation: number;
  amount_requested: number;
  equity_offered: number;
  revenue: number;
  total_assets: number;
  interest_bearing_debt: number;
  interest_income: number;
  bank_statements_file?: string | null;
  financial_statements_file?: string | null;
};

export function computeFlags(d: DealLike): Flag[] {
  const flags: Flag[] = [];

  const complete = !!d.bank_statements_file && !!d.financial_statements_file
    && d.amount_requested > 0 && d.equity_offered > 0 && d.sector;
  flags.push({
    code: "completeness",
    severity: complete ? "pass" : "warn",
    label: "Completeness",
    detail: complete ? "All required fields and documents present." : "Missing required fields or documents.",
  });

  const prohibited = PROHIBITED_SECTORS.includes(d.sector);
  flags.push({
    code: "sector",
    severity: prohibited ? "warn" : "pass",
    label: "Shariah sector screen",
    detail: prohibited
      ? `Sector "${d.sector}" is on the prohibited list.`
      : "Sector is permissible.",
  });

  const debtRatio = d.total_assets > 0 ? d.interest_bearing_debt / d.total_assets : 0;
  const incomeRatio = d.revenue > 0 ? d.interest_income / d.revenue : 0;
  const finFail = debtRatio > 0.33 || incomeRatio > 0.05;
  flags.push({
    code: "financial",
    severity: finFail ? "warn" : "pass",
    label: "Shariah financial screen",
    detail: finFail
      ? `Interest-bearing debt/assets ${(debtRatio*100).toFixed(1)}% (max 33%), interest income/revenue ${(incomeRatio*100).toFixed(1)}% (max 5%).`
      : `Debt/assets ${(debtRatio*100).toFixed(1)}%, interest income/revenue ${(incomeRatio*100).toFixed(1)}% — within limits.`,
  });

  const eligible = d.revenue >= 25000 && d.years_in_operation >= 1;
  flags.push({
    code: "eligibility",
    severity: eligible ? "pass" : "warn",
    label: "Eligibility",
    detail: eligible
      ? "Meets minimum revenue and operating history."
      : "Annual revenue under €25k or less than 1 year in operation.",
  });

  const valuation = d.equity_offered > 0 ? d.amount_requested / (d.equity_offered / 100) : 0;
  const valSane = d.revenue > 0 ? valuation <= 15 * d.revenue : false;
  flags.push({
    code: "valuation",
    severity: valSane ? "pass" : "warn",
    label: "Valuation sanity",
    detail: valSane
      ? `Implied valuation €${Math.round(valuation).toLocaleString()} ≤ 15× revenue.`
      : `Implied valuation €${Math.round(valuation).toLocaleString()} exceeds 15× revenue €${Math.round(d.revenue).toLocaleString()}.`,
  });

  return flags;
}

export function formatMoney(n: number) {
  return "€" + Math.round(n).toLocaleString();
}