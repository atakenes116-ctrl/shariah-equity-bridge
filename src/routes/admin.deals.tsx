import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMoney } from "@/lib/screening";
import { CheckCircle2, Circle, AlertTriangle, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/deals")({ component: DealsProgress });

const STAGES: { key: string; label: string }[] = [
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved / listed" },
  { key: "funds_in_escrow", label: "Funds in escrow" },
  { key: "equity_confirmed", label: "Equity confirmed" },
  { key: "completed", label: "Completed" },
];

function stageIndex(status: string) {
  const i = STAGES.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    under_review: { label: "Under review", cls: "bg-muted text-foreground" },
    approved: { label: "Approved", cls: "bg-primary/15 text-primary" },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
    funds_in_escrow: { label: "Funds in escrow", cls: "bg-amber-100 text-amber-900" },
    equity_confirmed: { label: "Equity confirmed", cls: "bg-emerald-100 text-emerald-900" },
    completed: { label: "Completed", cls: "bg-primary text-primary-foreground" },
    refunded: { label: "Refunded", cls: "bg-muted text-foreground" },
    disputed: { label: "Disputed", cls: "bg-destructive/15 text-destructive" },
    draft: { label: "Draft", cls: "bg-muted text-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function DealsProgress() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("deals").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setDeals(data ?? []);
      setLoading(false);
    });
  }, []);

  const totals = {
    all: deals.length,
    active: deals.filter((d) => ["under_review", "approved", "funds_in_escrow", "equity_confirmed"].includes(d.status)).length,
    completed: deals.filter((d) => d.status === "completed").length,
    issues: deals.filter((d) => ["rejected", "refunded", "disputed"].includes(d.status)).length,
    deployed: deals.filter((d) => ["funds_in_escrow", "equity_confirmed", "completed"].includes(d.status))
      .reduce((s, d) => s + Number(d.amount_requested ?? 0), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Investment progress</h1>
        <p className="text-sm text-muted-foreground">Track every deal through the escrow lifecycle.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total deals</div><div className="text-2xl font-semibold">{totals.all}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">In progress</div><div className="text-2xl font-semibold">{totals.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-semibold">{totals.completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Capital deployed</div><div className="text-2xl font-semibold">{formatMoney(totals.deployed)}</div></Card>
      </div>

      {loading && <Card className="p-8 text-center text-muted-foreground">Loading…</Card>}
      {!loading && deals.length === 0 && <Card className="p-8 text-center text-muted-foreground">No deals yet.</Card>}

      {!loading && deals.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SME</TableHead>
                <TableHead>Amount / equity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[320px]">Escrow progress</TableHead>
                <TableHead>Confirmations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => {
                const terminal = d.status === "completed";
                const failed = d.status === "rejected" || d.status === "refunded";
                const disputed = d.status === "disputed";
                const idx = stageIndex(d.status);
                const pct = terminal ? 100 : failed ? 0 : Math.round((idx / (STAGES.length - 1)) * 100);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.sme_name}</div>
                      <div className="text-xs text-muted-foreground">{d.sector} · {d.country}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatMoney(d.amount_requested)}</div>
                      <div className="text-xs text-muted-foreground">{d.equity_offered}% equity</div>
                    </TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell>
                      {failed ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="h-4 w-4 text-destructive" /> Did not proceed</div>
                      ) : disputed ? (
                        <div className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> In dispute</div>
                      ) : (
                        <div className="space-y-2">
                          <Progress value={pct} className="h-2" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            {STAGES.map((s, i) => (
                              <div key={s.key} className="flex flex-col items-center gap-0.5 w-1/5">
                                {i <= idx
                                  ? <CheckCircle2 className="h-3 w-3 text-primary" />
                                  : <Circle className="h-3 w-3" />}
                                <span className="text-center leading-tight">{s.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>SME equity: {d.sme_confirmed_equity ? "✓" : "—"}</div>
                      <div>Investor receipt: {d.investor_confirmed_receipt ? "✓" : "—"}</div>
                      {d.funded_at && <div className="text-muted-foreground">Funded {new Date(d.funded_at).toLocaleDateString()}</div>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}