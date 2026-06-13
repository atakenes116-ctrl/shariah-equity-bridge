import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/disputes")({ component: Disputes });

function Disputes() {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data: invs } = await supabase.from("investments").select("*").eq("status", "disputed").order("updated_at");
    const list = invs ?? [];
    if (list.length === 0) { setRows([]); return; }
    const { data: deals } = await supabase.from("deals").select("id,sme_name,amount_requested,equity_offered").in("id", list.map((i: any) => i.deal_id));
    const byId = new Map((deals ?? []).map((d: any) => [d.id, d]));
    setRows(list.map((i: any) => ({ ...i, deal: byId.get(i.deal_id) })));
  }
  useEffect(() => { load(); }, []);

  async function resolve(invId: string, outcome: "completed" | "refunded") {
    const update: any = { status: outcome };
    if (outcome === "completed") {
      const i = rows.find(r => r.id === invId);
      update.platform_fee = Number(i?.amount ?? 0) * 0.03;
    }
    const { error } = await supabase.from("investments").update(update).eq("id", invId);
    if (error) return toast.error(error.message);
    toast.success(`Resolved as ${outcome}`); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      {rows.length === 0 && <Card className="p-8 text-center text-muted-foreground">No open disputes.</Card>}
      {rows.map((i) => (
        <Card key={i.id} className="p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{i.deal?.sme_name ?? "—"}</h2>
            <Badge variant="destructive">Disputed</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Investor ticket: {formatMoney(i.amount)} ({Number(i.equity_percent).toFixed(2)}% equity) · round {formatMoney(i.deal?.amount_requested ?? 0)} for {i.deal?.equity_offered ?? 0}%
          </div>
          <div className="mt-3 text-sm">
            SME confirmed equity: {i.sme_confirmed_equity ? "yes" : "no"} · Investor confirmed receipt: {i.investor_confirmed_receipt ? "yes" : "no"}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => resolve(i.id, "completed")}>Release to SME</Button>
            <Button variant="outline" onClick={() => resolve(i.id, "refunded")}>Refund investor</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}