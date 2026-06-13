import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ALLOWED_SECTORS, computeFlags } from "@/lib/screening";
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
  const [f, setF] = useState({
    sme_name: profile?.name ?? "",
    sector: "Agriculture & Food",
    country: "",
    years_in_operation: 1,
    amount_requested: 50000,
    equity_offered: 10,
    use_of_funds: "",
    pitch: "",
    revenue: 0, net_profit: 0, total_assets: 0,
    interest_bearing_debt: 0, interest_income: 0,
  });
  const [bank, setBank] = useState<File | null>(null);
  const [fs, setFs] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function upd<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  const required = f.sme_name && f.sector && f.country && f.amount_requested > 0 && f.equity_offered > 0
    && f.use_of_funds && f.pitch && bank && fs;

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

      const flags = computeFlags({ ...f, bank_statements_file: bankPath, financial_statements_file: fsPath });
      const hasWarn = flags.some(x => x.severity === "warn");

      const { error } = await supabase.from("deals").insert({
        ...f,
        sme_id: user.id,
        bank_statements_file: bankPath,
        financial_statements_file: fsPath,
        flags,
        shariah_status: hasWarn ? "pending" : "compliant",
        status: "under_review",
      });
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
        <div><Label>Capital requested (€)</Label><Input type="number" min={0} value={f.amount_requested} onChange={e=>upd("amount_requested",+e.target.value)} /></div>
        <div><Label>Equity offered (%)</Label><Input type="number" min={0} max={100} value={f.equity_offered} onChange={e=>upd("equity_offered",+e.target.value)} /></div>
        <div className="md:col-span-2"><Label>Use of funds</Label><Textarea value={f.use_of_funds} onChange={e=>upd("use_of_funds",e.target.value)} required /></div>
        <div className="md:col-span-2"><Label>Short pitch</Label><Textarea value={f.pitch} onChange={e=>upd("pitch",e.target.value)} required /></div>
      </Card>

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