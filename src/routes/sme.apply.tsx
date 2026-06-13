import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ALLOWED_SECTORS, computeFlags, formatMoney } from "@/lib/screening";
import { MURABAHA_TIERS, computeMurabaha } from "@/lib/murabaha";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/sme/apply")({ component: ApplyPage });

function ApplyPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [dealType, setDealType] = useState<"musharakah" | "murabaha">("musharakah");
  const [f, setF] = useState({
    sme_name: profile?.name ?? "",
    sector: "Agriculture & Food",
    country: "",
    years_in_operation: 1,
    amount_requested: 50000,
    equity_offered: 10,
    min_investment: 12500,
    use_of_funds: "",
    pitch: "",
    revenue: 0, net_profit: 0, total_assets: 0,
    interest_bearing_debt: 0, interest_income: 0,
    asset_name: "",
    asset_description: "",
    asset_supplier: "",
    tenor_months: 12,
  });
  const [bank, setBank] = useState<File | null>(null);
  const [fs, setFs] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function upd<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  const sharedOk = f.sme_name && f.sector && f.country && f.amount_requested > 0
    && f.use_of_funds && f.pitch && bank && fs
    && f.min_investment > 0 && f.min_investment <= f.amount_requested;
  const required = sharedOk && (
    dealType === "musharakah"
      ? f.equity_offered > 0
      : !!f.asset_name && !!f.asset_supplier && f.tenor_months > 0
  );

  const mur = computeMurabaha(f.amount_requested, f.tenor_months);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !required) { toast.error("Please complete all fields and attach both documents."); return; }
    setSubmitting(true);
    try {
      const bankPath = `${user.id}/${Date.now()}-bank-${bank!.name}`;
      const fsPath = `${user.id}/${Date.now()}-fs-${fs!.name}`;
      const up1 = await supabase.storage.from("deal-docs").upload(bankPath, bank!);
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from("deal-docs").upload(fsPath, fs!);
      if (up2.error) throw up2.error;

      const flags = computeFlags({
        ...f,
        equity_offered: dealType === "musharakah" ? f.equity_offered : 0,
        bank_statements_file: bankPath,
        financial_statements_file: fsPath,
        deal_type: dealType,
      } as any);
      const hasWarn = flags.some(x => x.severity === "warn");

      const base: any = {
        sme_name: f.sme_name,
        sector: f.sector,
        country: f.country,
        years_in_operation: f.years_in_operation,
        amount_requested: f.amount_requested,
        min_investment: f.min_investment,
        use_of_funds: f.use_of_funds,
        pitch: f.pitch,
        revenue: f.revenue,
        net_profit: f.net_profit,
        total_assets: f.total_assets,
        interest_bearing_debt: f.interest_bearing_debt,
        interest_income: f.interest_income,
        sme_id: user.id,
        bank_statements_file: bankPath,
        financial_statements_file: fsPath,
        flags,
        shariah_status: hasWarn ? "pending" : "compliant",
        status: "under_review",
        deal_type: dealType,
      };
      if (dealType === "musharakah") {
        base.equity_offered = f.equity_offered;
      } else {
        base.equity_offered = null;
        base.asset_name = f.asset_name;
        base.asset_description = f.asset_description;
        base.asset_supplier = f.asset_supplier;
        base.tenor_months = f.tenor_months;
        base.profit_rate = mur.rate;
        base.total_repayable = mur.total;
      }
      const { error } = await supabase.from("deals").insert(base);
      if (error) throw error;
      toast.success("Application submitted for review.");
      navigate({ to: "/sme/status" });
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="text-2xl font-semibold">Funding application</h1>

      <Card className="p-6 space-y-3">
        <Label>Deal type</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDealType("musharakah")}
            className={`text-left rounded-lg border p-4 transition ${dealType === "musharakah" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/40"}`}>
            <div className="font-medium">Equity partnership (Musharakah)</div>
            <div className="text-xs text-muted-foreground mt-1">Raise growth capital by giving up equity. Investors share in profit and loss.</div>
          </button>
          <button type="button" onClick={() => setDealType("murabaha")}
            className={`text-left rounded-lg border p-4 transition ${dealType === "murabaha" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/40"}`}>
            <div className="font-medium">Asset purchase (Murabaha)</div>
            <div className="text-xs text-muted-foreground mt-1">Finance a specific asset (e.g. equipment). Repay cost + fixed profit in monthly installments. No equity given up.</div>
          </button>
        </div>
      </Card>

      <Card className="p-6 grid gap-4 md:grid-cols-2">
        <div><Label>Business name</Label><Input value={f.sme_name} onChange={e=>upd("sme_name",e.target.value)} required /></div>
        <div>
          <Label>Sector</Label>
          <Select value={f.sector} onValueChange={v=>upd("sector",v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALLOWED_SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Country</Label><Input value={f.country} onChange={e=>upd("country",e.target.value)} required /></div>
        <div><Label>Years in operation</Label><Input type="number" min={0} value={f.years_in_operation} onChange={e=>upd("years_in_operation",+e.target.value)} /></div>
        <div>
          <Label>{dealType === "murabaha" ? "Asset cost (€)" : "Capital requested (€)"}</Label>
          <Input type="number" min={0} value={f.amount_requested} onChange={e=>upd("amount_requested",+e.target.value)} />
        </div>
        {dealType === "musharakah" ? (
          <div><Label>Equity offered (%)</Label><Input type="number" min={0} max={100} value={f.equity_offered} onChange={e=>upd("equity_offered",+e.target.value)} /></div>
        ) : (
          <div>
            <Label>Repayment tenor</Label>
            <Select value={String(f.tenor_months)} onValueChange={v=>upd("tenor_months", +v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MURABAHA_TIERS.map(t => <SelectItem key={t.months} value={String(t.months)}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="md:col-span-2">
          <Label>Minimum investment per investor (€)</Label>
          <Input type="number" min={1} max={f.amount_requested} value={f.min_investment} onChange={e=>upd("min_investment",+e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Controls how many investors can join. Lower ticket = more investors. E.g. €{Math.max(1, Math.floor(f.amount_requested / Math.max(1, f.min_investment)))} max investors.
          </p>
        </div>
        <div className="md:col-span-2"><Label>Use of funds</Label><Textarea value={f.use_of_funds} onChange={e=>upd("use_of_funds",e.target.value)} required /></div>
        <div className="md:col-span-2"><Label>Short pitch</Label><Textarea value={f.pitch} onChange={e=>upd("pitch",e.target.value)} required /></div>
      </Card>

      {dealType === "murabaha" && (
        <Card className="p-6 grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 font-medium">Asset details</h2>
          <div><Label>Asset name</Label><Input value={f.asset_name} onChange={e=>upd("asset_name",e.target.value)} placeholder="e.g. CNC milling machine" /></div>
          <div><Label>Supplier</Label><Input value={f.asset_supplier} onChange={e=>upd("asset_supplier",e.target.value)} placeholder="e.g. Haas Automation BV" /></div>
          <div className="md:col-span-2"><Label>Asset description</Label><Textarea value={f.asset_description} onChange={e=>upd("asset_description",e.target.value)} placeholder="Specs, why it's needed, expected impact on revenue." /></div>
          <div className="md:col-span-2 rounded-md bg-secondary/60 p-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div><div className="text-[10px] uppercase text-muted-foreground">Total profit</div><div className="font-semibold">{formatMoney(mur.profit)} ({(mur.rate*100).toFixed(0)}%)</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground">Total repayable</div><div className="font-semibold">{formatMoney(mur.total)}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground">Monthly</div><div className="font-semibold">{formatMoney(mur.monthly)}</div></div>
          </div>
        </Card>
      )}

      <Card className="p-6 grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 font-medium">Financials (last 12 months)</h2>
        <div><Label>Annual revenue (€)</Label><Input type="number" value={f.revenue} onChange={e=>upd("revenue",+e.target.value)} /></div>
        <div><Label>Net profit (€)</Label><Input type="number" value={f.net_profit} onChange={e=>upd("net_profit",+e.target.value)} /></div>
        <div><Label>Total assets (€)</Label><Input type="number" value={f.total_assets} onChange={e=>upd("total_assets",+e.target.value)} /></div>
        <div><Label>Interest-bearing debt (€)</Label><Input type="number" value={f.interest_bearing_debt} onChange={e=>upd("interest_bearing_debt",+e.target.value)} /></div>
        <div><Label>Interest income (€)</Label><Input type="number" value={f.interest_income} onChange={e=>upd("interest_income",+e.target.value)} /></div>
      </Card>

      <Card className="p-6 grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 font-medium">Required documents (PDF)</h2>
        <div><Label>Bank statements (last 12 months)</Label><Input type="file" accept="application/pdf" onChange={e=>setBank(e.target.files?.[0] ?? null)} /></div>
        <div><Label>Financial statements (P&L + balance sheet)</Label><Input type="file" accept="application/pdf" onChange={e=>setFs(e.target.files?.[0] ?? null)} /></div>
      </Card>

      <Button type="submit" disabled={!required || submitting}>{submitting ? "Submitting…" : "Submit for review"}</Button>
      {!required && <p className="text-xs text-muted-foreground">All fields and both documents are required before you can submit.</p>}
    </form>
  );
}