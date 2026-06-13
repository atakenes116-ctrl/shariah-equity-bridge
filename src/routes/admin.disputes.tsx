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
  const [deals, setDeals] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("deals").select("*").eq("status", "disputed").order("created_at");
    setDeals(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string, outcome: "completed" | "refunded") {
    const update: any = { status: outcome };
    if (outcome === "completed") update.platform_fee = (deals.find(d => d.id === id)?.amount_requested ?? 0) * 0.03;
    const { error } = await supabase.from("deals").update(update).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Resolved as ${outcome}`); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      {deals.length === 0 && <Card className="p-8 text-center text-muted-foreground">No open disputes.</Card>}
      {deals.map((d) => (
        <Card key={d.id} className="p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{d.sme_name}</h2>
            <Badge variant="destructive">Disputed</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{formatMoney(d.amount_requested)} for {d.equity_offered}% equity</div>
          <div className="mt-3 text-sm">
            SME confirmed equity: {d.sme_confirmed_equity ? "yes" : "no"} · Investor confirmed receipt: {d.investor_confirmed_receipt ? "yes" : "no"}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => resolve(d.id, "completed")}>Release to SME</Button>
            <Button variant="outline" onClick={() => resolve(d.id, "refunded")}>Refund investor</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}