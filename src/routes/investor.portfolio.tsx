import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/screening";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/investor/portfolio")({ component: Portfolio });

function Portfolio() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: invs } = await supabase
        .from("investments").select("*")
        .eq("investor_id", user.id)
        .order("funded_at", { ascending: false });
      const list = invs ?? [];
      if (list.length === 0) { setRows([]); return; }
      const dealIds = Array.from(new Set(list.map((i: any) => i.deal_id)));
      const { data: deals } = await supabase.from("deals").select("id,sme_name,sector,country").in("id", dealIds);
      const byId = new Map((deals ?? []).map((d: any) => [d.id, d]));
      setRows(list.map((i: any) => ({ ...i, deal: byId.get(i.deal_id) })));
    })();
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My investments</h1>
      {rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No investments yet. Browse the marketplace to fund a deal.</Card>
      )}
      {rows.map((i) => (
        <Link key={i.id} to="/investor/room/$id" params={{ id: i.id }}>
          <Card className="p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold">{i.deal?.sme_name ?? "—"}</h2>
                  <Badge variant="outline">{i.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatMoney(i.amount)} · {Number(i.equity_percent).toFixed(2)}% equity
                </div>
                {i.deal && <div className="text-[11px] text-muted-foreground">{i.deal.sector} · {i.deal.country}</div>}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}