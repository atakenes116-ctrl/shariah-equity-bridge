import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/sme/status")({ component: StatusPage });

function statusLabel(s: string) { return s.replace(/_/g, " "); }

function StatusPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [invByDeal, setInvByDeal] = useState<Record<string, any[]>>({});
  const [insByDeal, setInsByDeal] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const { data: ds } = await supabase.from("deals").select("*").eq("sme_id", user.id).order("created_at", { ascending: false });
    setDeals(ds ?? []);
    if (ds && ds.length) {
      const { data: invs } = await supabase.from("investments").select("*").in("deal_id", ds.map((d: any) => d.id)).order("funded_at");
      const grouped: Record<string, any[]> = {};
      (invs ?? []).forEach((i: any) => { (grouped[i.deal_id] ||= []).push(i); });
      setInvByDeal(grouped);
      const murIds = ds.filter((d: any) => d.deal_type === "murabaha").map((d: any) => d.id);
      if (murIds.length) {
        const { data: ins } = await supabase.from("installments").select("*").in("deal_id", murIds).order("seq");
        const g2: Record<string, any[]> = {};
        (ins ?? []).forEach((x: any) => { (g2[x.deal_id] ||= []).push(x); });
        setInsByDeal(g2);
      }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function confirmEquity(invId: string) {
    const { error } = await supabase.from("investments").update({ sme_confirmed_equity: true }).eq("id", invId);
    if (error) return toast.error(error.message);
    const { data: ni } = await supabase.from("investments").select("*").eq("id", invId).maybeSingle();
    if (ni?.sme_confirmed_equity && ni?.investor_confirmed_receipt && ni.status === "funds_in_escrow") {
      await supabase.from("investments").update({ status: "equity_confirmed" }).eq("id", invId);
    }
    toast.success("Equity transfer confirmed");
    load();
  }

  async function markPaid(insId: string) {
    const { error } = await supabase.from("installments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", insId);
    if (error) return toast.error(error.message);
    toast.success("Installment marked paid");
    load();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My applications</h1>
        <Link to="/sme/apply"><Button>New application</Button></Link>
      </div>
      {deals.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No applications yet. Start by creating one.</Card>
      )}
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
          return (
            <Card key={d.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">{d.sme_name}</h2>
                    <Badge variant="outline">{isMur ? "Murabaha" : "Equity"}</Badge>
                    <Badge variant="outline">{statusLabel(d.status)}</Badge>
                    {d.shariah_status === "compliant" && d.status !== "under_review" && (
                      <Badge className="bg-primary text-primary-foreground">Shariah-compliant</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {isMur
                      ? <>Asset {formatMoney(d.amount_requested)} · {d.tenor_months}mo at {((d.profit_rate ?? 0)*100).toFixed(0)}% profit · min ticket {formatMoney(d.min_investment ?? 0)} · {d.sector} · {d.country}</>
                      : <>Seeking {formatMoney(d.amount_requested)} for {d.equity_offered}% equity · min ticket {formatMoney(d.min_investment ?? 0)} · {d.sector} · {d.country}</>}
                  </div>
                  {isMur && d.asset_name && (
                    <div className="text-xs text-muted-foreground mt-0.5"><b>{d.asset_name}</b>{d.asset_supplier ? ` · ${d.asset_supplier}` : ""}</div>
                  )}
                </div>
              </div>

              {(d.status === "approved" || d.status === "partially_funded" || d.status === "fully_funded" || d.status === "completed") && (
                <div className="mt-4 space-y-1.5">
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatMoney(raised)} raised · {pct}%</span>
                    <span>{isMur ? `${paid}/${ins.length || d.tenor_months || "—"} installments paid` : `${equityAllocated.toFixed(2)}% equity allocated`}</span>
                  </div>
                </div>
              )}

              {d.review_note && <p className="mt-3 text-sm rounded-md bg-muted p-3"><b>Admin note:</b> {d.review_note}</p>}

              {invs.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Investors</h3>
                  <div className="divide-y rounded-md border">
                    {invs.map((i) => (
                      <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="text-sm">
                          <div className="font-medium">
                            {formatMoney(i.amount)} · {isMur
                              ? `${Number(i.share_percent ?? 0).toFixed(2)}% share`
                              : `${Number(i.equity_percent ?? 0).toFixed(2)}% equity`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {statusLabel(i.status)} · receipt {i.investor_confirmed_receipt ? "✓" : "—"} · equity {i.sme_confirmed_equity ? "✓" : "—"}
                          </div>
                        </div>
                        {i.status === "funds_in_escrow" && !i.sme_confirmed_equity && (
                          <Button size="sm" onClick={() => confirmEquity(i.id)}>{isMur ? "Mark asset delivered" : "Mark equity issued"}</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isMur && ins.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Repayment schedule</h3>
                    <div className="text-xs text-muted-foreground">{paid}/{ins.length} paid ({repayPct}%)</div>
                  </div>
                  <Progress value={repayPct} className="h-2 mb-2" />
                  <div className="divide-y rounded-md border max-h-72 overflow-auto">
                    {ins.map((x) => (
                      <div key={x.id} className="flex items-center justify-between p-2.5 text-sm">
                        <div>
                          <div className="font-medium">#{x.seq} · due {new Date(x.due_date).toLocaleDateString()}</div>
                          <div className="text-[11px] text-muted-foreground">{formatMoney(Number(x.total_amount))}{x.paid_at ? ` · paid ${new Date(x.paid_at).toLocaleDateString()}` : ""}</div>
                        </div>
                        {x.status === "paid" ? (
                          <Badge className="bg-primary text-primary-foreground">paid</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markPaid(x.id)}>Mark paid</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Screening report</h3>
                <ul className="space-y-1.5">
                  {(d.flags as any[]).map((f) => (
                    <li key={f.code} className="flex items-start gap-2 text-sm">
                      {f.severity === "pass"
                        ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                      <span><b>{f.label}:</b> <span className="text-muted-foreground">{f.detail}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}