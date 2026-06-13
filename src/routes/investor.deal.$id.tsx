import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/investor/deal/$id")({ component: DealDetail });

function DealDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [funding, setFunding] = useState(false);

  async function load() {
    const { data } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    setD(data);
  }
  useEffect(() => { load(); }, [id]);

  async function fund() {
    if (!user || !d) return;
    setFunding(true);
    try {
      // Lock atomically: only succeed if still approved & unfunded
      const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: updated, error } = await supabase.from("deals")
        .update({ investor_id: user.id, status: "funds_in_escrow", funded_at: new Date().toISOString(), deadline })
        .eq("id", id).eq("status", "approved").is("investor_id", null)
        .select().maybeSingle();
      if (error) throw error;
      if (!updated) { toast.error("This deal is no longer available."); navigate({ to: "/investor" }); return; }
      // Debit investor wallet
      const { data: prof } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).maybeSingle();
      await supabase.from("profiles").update({ wallet_balance: (prof?.wallet_balance ?? 0) - d.amount_requested }).eq("id", user.id);
      toast.success("Funds placed in escrow");
      navigate({ to: "/investor/room/$id", params: { id } });
    } catch (e: any) {
      toast.error(e.message ?? "Funding failed");
    } finally { setFunding(false); }
  }

  if (!d) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const valuation = d.amount_requested / (d.equity_offered / 100);

  return (
    <div className="space-y-4">
      <Link to="/investor" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Marketplace</Link>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{d.sme_name}</h1>
          <Badge className="bg-primary text-primary-foreground">Shariah-compliant</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{d.sector} · {d.country} · {d.years_in_operation}y in operation</div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Capital" value={formatMoney(d.amount_requested)} />
          <Stat label="Equity" value={`${d.equity_offered}%`} />
          <Stat label="Valuation" value={formatMoney(valuation)} />
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Terms (musharakah)</h2>
        <p className="text-sm text-muted-foreground">
          You receive a <b>{d.equity_offered}% equity stake</b> in {d.sme_name}.
          Returns are profit-and-loss shared in proportion to your equity.
          This is a true partnership — there is no fixed or guaranteed return.
        </p>
        <ul className="text-sm space-y-1 mt-2">
          <li>· Capital deployed: {formatMoney(d.amount_requested)}</li>
          <li>· Equity received: {d.equity_offered}%</li>
          <li>· Implied valuation: {formatMoney(valuation)}</li>
          <li>· Platform service fee: 3% on release</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Shariah review</h2>
        <ul className="space-y-1.5 text-sm">
          {(d.flags as any[]).map((f) => (
            <li key={f.code} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{f.label}: <span className="text-muted-foreground">{f.detail}</span></span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium">About the business</h2>
        <p className="text-sm text-muted-foreground mt-1">{d.pitch}</p>
        <p className="text-sm text-muted-foreground mt-2"><b>Use of funds:</b> {d.use_of_funds}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <KV k="Annual revenue" v={formatMoney(d.revenue)} />
          <KV k="Net profit" v={formatMoney(d.net_profit)} />
          <KV k="Total assets" v={formatMoney(d.total_assets)} />
          <KV k="Interest-bearing debt" v={formatMoney(d.interest_bearing_debt)} />
        </div>
      </Card>

      <Button size="lg" className="w-full" disabled={funding} onClick={fund}>
        {funding ? "Placing funds…" : `Fund ${formatMoney(d.amount_requested)} into escrow`}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="rounded-md bg-muted/60 px-2 py-1.5"><div className="text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
}