import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/screening";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/investor/")({ component: Marketplace });

function Marketplace() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("deals").select("*")
      .in("status", ["approved", "partially_funded"])
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDeals(data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Live deals</h1>
        <p className="text-sm text-muted-foreground">Each opportunity is screened and approved. One investor per deal.</p>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!loading && deals.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No live deals right now — check back soon.</Card>
      )}
      {deals.map((d) => {
        const valuation = d.amount_requested / (d.equity_offered / 100);
        const raised = Number(d.funded_amount ?? 0);
        const pct = Math.min(100, Math.round((raised / d.amount_requested) * 100));
        const remaining = Math.max(0, d.amount_requested - raised);
        return (
          <Link key={d.id} to="/investor/deal/$id" params={{ id: d.id }}>
            <Card className="p-4 hover:shadow-md transition active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold truncate">{d.sme_name}</h2>
                    <Badge className="bg-primary text-primary-foreground">Shariah-compliant</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.sector} · {d.country}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Capital" value={formatMoney(d.amount_requested)} />
                <Stat label="Equity" value={`${d.equity_offered}%`} />
                <Stat label="Valuation" value={formatMoney(valuation)} />
              </div>
              <div className="mt-3 space-y-1.5">
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatMoney(raised)} raised · {pct}%</span>
                  <span>Min ticket {formatMoney(d.min_investment || 0)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{formatMoney(remaining)} remaining</div>
              </div>
            </Card>
          </Link>
        );
      })}
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