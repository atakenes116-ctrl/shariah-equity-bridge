import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/screening";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/investor/room/$id")({ component: DealRoom });

const STEPS: { key: string; label: string }[] = [
  { key: "funds_in_escrow", label: "Funds in escrow" },
  { key: "equity_confirmed", label: "Equity confirmed" },
  { key: "completed", label: "Funds released to SME" },
];

function DealRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [d, setD] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    setD(data);
  }
  useEffect(() => { load(); }, [id]);

  if (!d) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const stepIdx = ["funds_in_escrow", "equity_confirmed", "completed"].indexOf(d.status);

  async function confirmReceipt() {
    const { error } = await supabase.from("deals").update({ investor_confirmed_receipt: true }).eq("id", id);
    if (error) return toast.error(error.message);
    const { data: nd } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    if (nd?.sme_confirmed_equity && nd?.investor_confirmed_receipt && nd.status === "funds_in_escrow") {
      await supabase.from("deals").update({ status: "equity_confirmed" }).eq("id", id);
    }
    toast.success("Equity receipt confirmed"); load();
  }

  async function release() {
    const fee = d.amount_requested * 0.03;
    const { error } = await supabase.from("deals").update({ status: "completed", platform_fee: fee }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Released ${formatMoney(d.amount_requested - fee)} to SME (3% fee retained)`);
    load();
  }

  async function raiseDispute() {
    const { error } = await supabase.from("deals").update({ status: "disputed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dispute raised — admin will review"); load();
  }

  const isInvestor = user?.id === d.investor_id;

  return (
    <div className="space-y-4">
      <Link to="/investor/portfolio" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> My investments</Link>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{d.sme_name}</h1>
          <Badge variant="outline">{d.status.replace(/_/g, " ")}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{formatMoney(d.amount_requested)} for {d.equity_offered}% equity</div>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Escrow progress</h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => {
            const done = i <= stepIdx && d.status !== "refunded" && d.status !== "disputed";
            return (
              <li key={s.key} className="flex items-start gap-3">
                {done ? <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" /> : <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />}
                <div>
                  <div className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{s.label}</div>
                </div>
              </li>
            );
          })}
          {d.status === "refunded" && <li className="flex items-start gap-3 text-sm"><AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" /> Refunded to investor</li>}
          {d.status === "disputed" && <li className="flex items-start gap-3 text-sm"><AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" /> In dispute — awaiting admin</li>}
        </ol>
      </Card>

      <Card className="p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">SME confirmed equity transfer</span><span>{d.sme_confirmed_equity ? "✓" : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Investor confirmed receipt</span><span>{d.investor_confirmed_receipt ? "✓" : "—"}</span></div>
        {d.deadline && <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span>{new Date(d.deadline).toLocaleDateString()}</span></div>}
      </Card>

      {isInvestor && d.status === "funds_in_escrow" && !d.investor_confirmed_receipt && (
        <Button className="w-full" onClick={confirmReceipt}>Confirm equity received</Button>
      )}
      {isInvestor && d.status === "equity_confirmed" && (
        <Button className="w-full" onClick={release}>Release funds to SME (minus 3% fee)</Button>
      )}
      {isInvestor && (d.status === "funds_in_escrow" || d.status === "equity_confirmed") && (
        <Button variant="outline" className="w-full" onClick={raiseDispute}>Raise a dispute</Button>
      )}
    </div>
  );
}