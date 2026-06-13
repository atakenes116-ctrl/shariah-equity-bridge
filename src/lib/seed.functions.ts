import { createServerFn } from "@tanstack/react-start";

export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const demos = [
    { email: "sme@demo.app", password: "demo1234", name: "Amina Hassan", role: "sme" as const },
    { email: "investor@demo.app", password: "demo1234", name: "Yusuf Karim", role: "investor" as const },
    { email: "admin@demo.app", password: "demo1234", name: "Platform Admin", role: "admin" as const },
  ];

  const ids: Record<string, string> = {};

  for (const d of demos) {
    // Try to find existing user by email
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email === d.email);
    if (existing) {
      ids[d.role] = existing.id;
      // Ensure profile reflects correct role/name/balance
      await supabaseAdmin.from("profiles").upsert({
        id: existing.id, name: d.name, role: d.role,
        wallet_balance: d.role === "investor" ? 500000 : 0,
      });
      continue;
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
      user_metadata: { name: d.name, role: d.role },
    });
    if (error || !created.user) throw new Error(`Failed to create ${d.email}: ${error?.message}`);
    ids[d.role] = created.user.id;
  }

  // Reset & seed deals
  await supabaseAdmin.from("deals").delete().eq("sme_id", ids.sme);

  // Deal 1: approved, no flags — organic food distributor
  const cleanDeal = {
    sme_id: ids.sme,
    sme_name: "Barakah Organic Foods",
    sector: "Agriculture & Food",
    country: "Netherlands",
    years_in_operation: 4,
    amount_requested: 100000,
    equity_offered: 15,
    min_investment: 10000,
    use_of_funds: "Expand cold-chain logistics to serve three additional cities and onboard 20 new producers.",
    pitch: "Profitable B2B distributor of certified organic food, growing 35% YoY. Capital accelerates regional expansion.",
    revenue: 300000,
    net_profit: 48000,
    total_assets: 180000,
    interest_bearing_debt: 0,
    interest_income: 0,
    bank_statements_file: "seed/clean_bank.pdf",
    financial_statements_file: "seed/clean_fs.pdf",
    shariah_status: "compliant",
    status: "approved" as const,
    reviewed_by: ids.admin,
    flags: [
      { code: "completeness", severity: "pass", label: "Completeness", detail: "All required fields and documents present." },
      { code: "sector", severity: "pass", label: "Shariah sector screen", detail: "Sector is permissible." },
      { code: "financial", severity: "pass", label: "Shariah financial screen", detail: "Debt/assets 0%, interest income/revenue 0% — within limits." },
      { code: "eligibility", severity: "pass", label: "Eligibility", detail: "Meets minimum revenue and operating history." },
      { code: "valuation", severity: "pass", label: "Valuation sanity", detail: "Implied valuation €666,667 ≤ 15× revenue." },
    ],
  };

  // Deal 2: under review, with warnings — interest income too high
  const flaggedDeal = {
    sme_id: ids.sme,
    sme_name: "Crescent Trading Co.",
    sector: "Conventional Finance",
    country: "United Kingdom",
    years_in_operation: 2,
    amount_requested: 250000,
    equity_offered: 10,
    min_investment: 50000,
    use_of_funds: "Working capital for expanding short-term financing operations.",
    pitch: "Trading firm with strong margins seeking growth capital.",
    revenue: 400000,
    net_profit: 60000,
    total_assets: 500000,
    interest_bearing_debt: 220000,
    interest_income: 45000,
    bank_statements_file: "seed/flag_bank.pdf",
    financial_statements_file: "seed/flag_fs.pdf",
    shariah_status: "pending",
    status: "under_review" as const,
    flags: [
      { code: "completeness", severity: "pass", label: "Completeness", detail: "All required fields and documents present." },
      { code: "sector", severity: "warn", label: "Shariah sector screen", detail: "Sector \"Conventional Finance\" is on the prohibited list." },
      { code: "financial", severity: "warn", label: "Shariah financial screen", detail: "Interest-bearing debt/assets 44.0% (max 33%), interest income/revenue 11.3% (max 5%)." },
      { code: "eligibility", severity: "pass", label: "Eligibility", detail: "Meets minimum revenue and operating history." },
      { code: "valuation", severity: "warn", label: "Valuation sanity", detail: "Implied valuation €2,500,000 exceeds 15× revenue €400,000." },
    ],
  };

  await supabaseAdmin.from("deals").insert([cleanDeal, flaggedDeal]);

  return { ok: true, accounts: demos.map(d => ({ email: d.email, password: d.password, role: d.role })) };
});