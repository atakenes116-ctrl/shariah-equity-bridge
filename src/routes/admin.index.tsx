import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: ReviewQueue });

function ReviewQueue() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("deals").select("*").eq("status", "under_review").order("created_at");
    setDeals(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    const { error } = await supabase.from("deals").update({
      status: decision,
      reviewed_by: user?.id,
      review_note: notes[id] ?? null,
      shariah_status: decision === "approved" ? "compliant" : "rejected",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Application ${decision}`); load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Review queue</h1>
      {deals.length === 0 && <Card className="p-8 text-center text-muted-foreground">Inbox zero. No applications pending review.</Card>}
      {deals.map((d) => {
        const warnCount = (d.flags as any[]).filter(f => f.severity === "warn").length;
        return (
          <Card key={d.id} className="p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{d.sme_name}</h2>
                  {warnCount > 0 ? <Badge variant="destructive">{warnCount} warnings</Badge> : <Badge className="bg-primary text-primary-foreground">Clean</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {d.sector} · {d.country} · {d.years_in_operation}y · seeking {formatMoney(d.amount_requested)} for {d.equity_offered}%
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium mb-2">Automated screening</h3>
                <ul className="space-y-1.5 text-sm">
                  {(d.flags as any[]).map((f) => (
                    <li key={f.code} className="flex items-start gap-2">
                      {f.severity === "pass"
                        ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                      <span><b>{f.label}:</b> <span className="text-muted-foreground">{f.detail}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 text-sm">
                <h3 className="font-medium">Application</h3>
                <p className="text-muted-foreground"><b>Pitch:</b> {d.pitch}</p>
                <p className="text-muted-foreground"><b>Use of funds:</b> {d.use_of_funds}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>Revenue: {formatMoney(d.revenue)}</div>
                  <div>Net profit: {formatMoney(d.net_profit)}</div>
                  <div>Total assets: {formatMoney(d.total_assets)}</div>
                  <div>Interest-bearing debt: {formatMoney(d.interest_bearing_debt)}</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Input placeholder="Optional note to the SME…" value={notes[d.id] ?? ""} onChange={e => setNotes(n => ({...n, [d.id]: e.target.value}))} />
              <div className="flex gap-2">
                <Button onClick={() => decide(d.id, "approved")}>Approve</Button>
                <Button variant="outline" onClick={() => decide(d.id, "rejected")}>Reject</Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}