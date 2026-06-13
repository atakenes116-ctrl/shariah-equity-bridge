import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/sme/status")({ component: StatusPage });

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

function StatusPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("deals").select("*").eq("sme_id", user.id).order("created_at", { ascending: false });
    setDeals(data ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function confirmEquity(id: string) {
    const { error } = await supabase.from("deals").update({ sme_confirmed_equity: true }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: d } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (d?.sme_confirmed_equity && d?.investor_confirmed_receipt && d.status === "funds_in_escrow") {
      await supabase.from("deals").update({ status: "equity_confirmed" }).eq("id", id);
    }
    toast.success("Equity transfer confirmed");
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
        {deals.map((d) => (
          <Card key={d.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg">{d.sme_name}</h2>
                  <Badge variant="outline">{statusLabel(d.status)}</Badge>
                  {d.shariah_status === "compliant" && d.status === "approved" && (
                    <Badge className="bg-primary text-primary-foreground">Shariah-compliant</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Seeking {formatMoney(d.amount_requested)} for {d.equity_offered}% equity · {d.sector} · {d.country}
                </div>
              </div>
              {d.status === "funds_in_escrow" && !d.sme_confirmed_equity && (
                <Button onClick={() => confirmEquity(d.id)}>Mark equity transferred</Button>
              )}
            </div>
            {d.review_note && <p className="mt-3 text-sm rounded-md bg-muted p-3"><b>Admin note:</b> {d.review_note}</p>}
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
        ))}
      </div>
    </div>
  );
}