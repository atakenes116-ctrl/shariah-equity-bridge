import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/lib/screening";
import { computeMurabaha, investorMonthly } from "@/lib/murabaha";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/investor/deal/$id")({ component: DealDetail });

function DealDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [wallet, setWallet] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [funding, setFunding] = useState(false);

  async function load() {
    const { data } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
    setD(data);
    if (data) {
      const remaining = Math.max(0, data.amount_requested - Number(data.funded_amount ?? 0));
      setAmount(Math.min(remaining, Math.max(data.min_investment ?? 0, remaining)));
    }
    if (user) {
      const { data: p } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).maybeSingle();
      setWallet(Number(p?.wallet_balance ?? 0));
    }
  }
  useEffect(() => { load(); }, [id, user?.id]);

  async function fund() {
    if (!user || !d) return;
    const remaining = Math.max(0, d.amount_requested - Number(d.funded_amount ?? 0));
    if (amount < (d.min_investment ?? 0)) return toast.error(`Minimum ticket is ${formatMoney(d.min_investment)}`);
    if (amount > remaining) return toast.error(`Only ${formatMoney(remaining)} remaining`);
    if (amount > wallet) return toast.error("Insufficient wallet balance");
    setFunding(true);
    try {
      const payload: any = {
        deal_id: id,
        investor_id: user.id,
        amount,
      };
      if (d.deal_type !== "murabaha") {
        payload.equity_percent = (amount / d.amount_requested) * (d.equity_offered ?? 0);
      }
      const { data: inv, error } = await supabase.from("investments").insert(payload).select().maybeSingle();
      if (error) throw error;
      await supabase.from("profiles").update({ wallet_balance: wallet - amount }).eq("id", user.id);
      toast.success("Funds placed in escrow");
      navigate({ to: "/investor/room/$id", params: { id: inv!.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Funding failed");
    } finally { setFunding(false); }
  }

  if (!d) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const isMur = d.deal_type === "murabaha";
  const valuation = !isMur && d.equity_offered ? d.amount_requested / (d.equity_offered / 100) : 0;
  const raised = Number(d.funded_amount ?? 0);
  const remaining = Math.max(0, d.amount_requested - raised);
  const pctRaised = Math.round((raised / d.amount_requested) * 100);
  const minTicket = Number(d.min_investment ?? 0);
  const myEquity = !isMur && d.amount_requested > 0 ? (amount / d.amount_requested) * (d.equity_offered ?? 0) : 0;
  const sliderMax = Math.max(minTicket, remaining);
  const mur = isMur ? computeMurabaha(d.amount_requested, d.tenor_months ?? 0) : null;
  const myMur = isMur ? investorMonthly(amount, d.amount_requested, d.tenor_months ?? 0) : null;

  return (
    <div className="space-y-4">
      <Link to="/investor" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Marketplace</Link>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{d.sme_name}</h1>
          <Badge variant="outline">{isMur ? "Murabaha" : "Equity"}</Badge>
          <Badge className="bg-primary text-primary-foreground">Shariah-compliant</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{d.sector} · {d.country} · {d.years_in_operation}y in operation</div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Capital" value={formatMoney(d.amount_requested)} />
          {isMur ? (
            <>
              <Stat label="Profit" value={`${((mur?.rate ?? 0)*100).toFixed(0)}%`} />
              <Stat label="Tenor" value={`${d.tenor_months}mo`} />
            </>
          ) : (
            <>
              <Stat label="Equity" value={`${d.equity_offered}%`} />
              <Stat label="Valuation" value={formatMoney(valuation)} />
            </>
          )}
        </div>
        <div className="mt-4 space-y-1.5">
          <Progress value={Math.min(100, pctRaised)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatMoney(raised)} raised ({pctRaised}%)</span>
            <span>{formatMoney(remaining)} remaining</span>
          </div>
        </div>
      </Card>

      {isMur ? (
        <Card className="p-4 space-y-2">
          <h2 className="font-medium">Terms (murabaha)</h2>
          <p className="text-sm text-muted-foreground">
            The platform purchases <b>{d.asset_name}</b> from {d.asset_supplier} on behalf of {d.sme_name}.
            The SME repays cost + {((mur?.rate ?? 0)*100).toFixed(0)}% profit in {d.tenor_months} equal monthly installments.
            No equity changes hands. Profit is fixed at the start — this is a sale, not a loan.
          </p>
          {d.asset_description && <p className="text-sm text-muted-foreground"><b>Asset:</b> {d.asset_description}</p>}
          <ul className="text-sm space-y-1 mt-2">
            <li>· Asset cost: {formatMoney(d.amount_requested)}</li>
            <li>· Total profit: {formatMoney(mur?.profit ?? 0)} ({((mur?.rate ?? 0)*100).toFixed(0)}%)</li>
            <li>· Total repayable: {formatMoney(mur?.total ?? 0)} over {d.tenor_months} months</li>
            <li>· Monthly installment (whole deal): {formatMoney(mur?.monthly ?? 0)}</li>
            <li>· Minimum ticket: {formatMoney(minTicket)}</li>
          </ul>
        </Card>
      ) : (
        <Card className="p-4 space-y-2">
          <h2 className="font-medium">Terms (musharakah)</h2>
          <p className="text-sm text-muted-foreground">
            You join a partnership in {d.sme_name}, taking a <b>proportional equity stake</b> based on your ticket.
            Returns are profit-and-loss shared in proportion to equity held.
            This is a true partnership — there is no fixed or guaranteed return.
          </p>
          <ul className="text-sm space-y-1 mt-2">
            <li>· Total round: {formatMoney(d.amount_requested)} for {d.equity_offered}% equity</li>
            <li>· Minimum ticket: {formatMoney(minTicket)}</li>
            <li>· Implied valuation: {formatMoney(valuation)}</li>
            <li>· Platform service fee: 3% on release</li>
          </ul>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Shariah review</h2>
        <ul className="space-y-1.5 text-sm">
          {(d.flags as any[]).map((f) => (
            <li key={f.code} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{f.label}: <span className="text-muted-foreground">{f.detail}</span></span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium">About the business</h2>
        <p className="text-sm text-muted-foreground mt-1">{d.pitch}</p>
        <p className="text-sm text-muted-foreground mt-2"><b>Use of funds:</b> {d.use_of_funds}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <KV k="Annual revenue" v={formatMoney(d.revenue)} />
          <KV k="Net profit" v={formatMoney(d.net_profit)} />
          <KV k="Total assets" v={formatMoney(d.total_assets)} />
          <KV k="Interest-bearing debt" v={formatMoney(d.interest_bearing_debt)} />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-medium">Your ticket</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Investment amount</Label>
            <span className="text-xs text-muted-foreground">Wallet: {formatMoney(wallet)}</span>
          </div>
          <Input
            type="number"
            min={minTicket}
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(+e.target.value)}
          />
          {sliderMax > minTicket && (
            <Slider
              value={[Math.min(amount, sliderMax)]}
              min={minTicket}
              max={sliderMax}
              step={Math.max(1, Math.round(minTicket / 10))}
              onValueChange={(v) => setAmount(v[0])}
            />
          )}
          {isMur ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="You pay" value={formatMoney(amount)} />
              <Stat label="Monthly receivable" value={formatMoney(myMur?.monthly ?? 0)} />
              <Stat label="Total received" value={formatMoney(myMur?.totalReceive ?? 0)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-center">
              <Stat label="You pay" value={formatMoney(amount)} />
              <Stat label="Equity you receive" value={`${myEquity.toFixed(2)}%`} />
            </div>
          )}
          {isMur && (
            <p className="text-[11px] text-muted-foreground">
              Profit on your ticket: {formatMoney(myMur?.profit ?? 0)} over {d.tenor_months} months.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Min {formatMoney(minTicket)} · Max remaining {formatMoney(remaining)}.
          </p>
        </div>
        <Button size="lg" className="w-full" disabled={funding || amount < minTicket || amount > remaining || amount > wallet} onClick={fund}>
          {funding ? "Placing funds…" : `Fund ${formatMoney(amount)} into escrow`}
        </Button>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="rounded-md bg-muted/60 px-2 py-1.5"><div className="text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
}