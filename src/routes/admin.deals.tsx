import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/screening";
import { AlertTriangle, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/deals")({ component: DealsProgress });

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    under_review: { label: "Under review", cls: "bg-muted text-foreground" },
    approved: { label: "Approved", cls: "bg-primary/15 text-primary" },
    partially_funded: { label: "Partially funded", cls: "bg-amber-100 text-amber-900" },
    fully_funded: { label: "Fully funded", cls: "bg-emerald-100 text-emerald-900" },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
    completed: { label: "Completed", cls: "bg-primary text-primary-foreground" },
    disputed: { label: "Disputed", cls: "bg-destructive/15 text-destructive" },
    refunded: { label: "Refunded", cls: "bg-muted text-foreground" },
    draft: { label: "Draft", cls: "bg-muted text-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function DealsProgress() {
  const [deals, setDeals] = useState<any[]>([]);
  const [invByDeal, setInvByDeal] = useState<Record<string, any[]>>({});
  const [insByDeal, setInsByDeal] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: ds } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      setDeals(ds ?? []);
      if (ds && ds.length) {
        const { data: invs } = await supabase.from("investments").select("*").in("deal_id", ds.map((d: any) => d.id));
        const g: Record<string, any[]> = {};
        (invs ?? []).forEach((i: any) => { (g[i.deal_id] ||= []).push(i); });
        setInvByDeal(g);
        const murIds = ds.filter((d: any) => d.deal_type === "murabaha").map((d: any) => d.id);
        if (murIds.length) {
          const { data: ins } = await supabase.from("installments").select("*").in("deal_id", murIds).order("seq");
          const g2: Record<string, any[]> = {};
          (ins ?? []).forEach((x: any) => { (g2[x.deal_id] ||= []).push(x); });
          setInsByDeal(g2);
        }
      }
      setLoading(false);
    })();
  }, []);

  const totals = {
    all: deals.length,
    active: deals.filter((d) => ["under_review", "approved", "partially_funded", "fully_funded"].includes(d.status)).length,
    completed: deals.filter((d) => d.status === "completed").length,
    deployed: deals.reduce((s, d) => s + Number(d.funded_amount ?? 0), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Investment progress</h1>
        <p className="text-sm text-muted-foreground">Per-deal funding progress with each investor's slice.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total deals</div><div className="text-2xl font-semibold">{totals.all}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">In progress</div><div className="text-2xl font-semibold">{totals.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-semibold">{totals.completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Capital deployed</div><div className="text-2xl font-semibold">{formatMoney(totals.deployed)}</div></Card>
      </div>

      {loading && <Card className="p-8 text-center text-muted-foreground">Loading…</Card>}
      {!loading && deals.length === 0 && <Card className="p-8 text-center text-muted-foreground">No deals yet.</Card>}

      <div className="space-y-4">
        {deals.map((d) => {
          const isMur = d.deal_type === "murabaha";
          const raised = Number(d.funded_amount ?? 0);
          const pct = Math.min(100, Math.round((raised / d.amount_requested) * 100));
          const invs = invByDeal[d.id] ?? [];
          const equityAllocated = invs.reduce((s, i) => s + Number(i.equity_percent ?? 0), 0);
          const ins = insByDeal[d.id] ?? [];
          const paid = ins.filter((x) => x.status === "paid").length;
          const repayPct = ins.length ? Math.round((paid / ins.length) * 100) : 0;
          const failed = d.status === "rejected" || d.status === "refunded";
          return (
            <Card key={d.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{d.sme_name}</div>
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-secondary">{isMur ? "Murabaha" : "Equity"}</span>
                    {statusBadge(d.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.sector} · {d.country} · {isMur
                      ? <>asset {formatMoney(d.amount_requested)} · {d.tenor_months}mo · {((d.profit_rate ?? 0)*100).toFixed(0)}%</>
                      : <>seeking {formatMoney(d.amount_requested)} for {d.equity_offered}%</>}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{formatMoney(raised)} / {formatMoney(d.amount_requested)}</div>
                  <div className="text-xs text-muted-foreground">
                    {isMur ? `${paid}/${ins.length || d.tenor_months || "—"} installments paid` : `${equityAllocated.toFixed(2)}% equity allocated`}
                  </div>
                </div>
              </div>

              {failed ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="h-4 w-4 text-destructive" /> Did not proceed</div>
              ) : d.status === "under_review" ? (
                <div className="text-sm text-muted-foreground">Awaiting admin review.</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Progress value={pct} className="h-2" />
                    <div className="text-[11px] text-muted-foreground">{pct}% funded</div>
                  </div>
                  {isMur && (
                    <div className="space-y-1.5">
                      <Progress value={repayPct} className="h-2" />
                      <div className="text-[11px] text-muted-foreground">{repayPct}% repaid ({paid}/{ins.length || "—"})</div>
                    </div>
                  )}
                </div>
              )}

              {invs.length > 0 && (
                <div className="rounded-md border divide-y">
                  {invs.map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                      <div>
                        <div className="font-medium">{formatMoney(i.amount)} · {isMur
                          ? `${Number(i.share_percent ?? 0).toFixed(2)}% share`
                          : `${Number(i.equity_percent ?? 0).toFixed(2)}% equity`}</div>
                        <div className="text-xs text-muted-foreground">
                          Investor {i.investor_id.slice(0, 8)}… · funded {new Date(i.funded_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-xs">
                        {statusBadge(i.status)}
                        <div className="mt-1 text-muted-foreground">SME ✓ {i.sme_confirmed_equity ? "yes" : "no"} · receipt ✓ {i.investor_confirmed_receipt ? "yes" : "no"}</div>
                      </div>
                      {i.status === "disputed" && <div className="flex items-center gap-1 text-amber-700 text-xs"><AlertTriangle className="h-3 w-3" /> In dispute</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}