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
  const [deals, setDeals] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("deals").select("*").eq("investor_id", user.id).order("funded_at", { ascending: false })
      .then(({ data }) => setDeals(data ?? []));
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My investments</h1>
      {deals.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No investments yet. Browse the marketplace to fund a deal.</Card>
      )}
      {deals.map((d) => (
        <Link key={d.id} to="/investor/room/$id" params={{ id: d.id }}>
          <Card className="p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold">{d.sme_name}</h2>
                  <Badge variant="outline">{d.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{formatMoney(d.amount_requested)} · {d.equity_offered}% equity</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}