import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoData } from "@/lib/seed.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Sparkles, Handshake } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Halal Capital — Shariah SME Financing" },
      { name: "description", content: "Match SMEs with investors through Shariah-compliant equity partnerships." },
    ],
  }),
  component: Landing,
});

function roleHome(role?: string) {
  if (role === "investor") return "/investor";
  if (role === "admin") return "/admin";
  return "/sme/status";
}

function Landing() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const seed = useServerFn(seedDemoData);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!loading && profile) navigate({ to: roleHome(profile.role) });
  }, [loading, profile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-accent/40">
      <header className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
          <span className="font-semibold tracking-tight">Halal Capital</span>
        </div>
        <Button variant="outline" size="sm" onClick={async () => {
          setSeeding(true);
          try { await seed(); toast.success("Demo accounts ready"); }
          catch (e: any) { toast.error(e.message ?? "Seed failed"); }
          finally { setSeeding(false); }
        }} disabled={seeding}>{seeding ? "Seeding…" : "Seed demo data"}</Button>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-2 lg:py-16">
        <section>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Shariah-compliant capital for growing SMEs.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            One business, one investor, one transparent musharakah partnership.
            Profit and loss shared in proportion to equity — never interest, never debt.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, t: "Vetted", d: "Each deal Shariah-screened and admin-reviewed." },
              { icon: Handshake, t: "Aligned", d: "Investors share in profit and loss — true partnership." },
              { icon: Sparkles, t: "Transparent", d: "Escrow-tracked, dual confirmation on equity transfer." },
            ].map((x, i) => (
              <Card key={i} className="p-4">
                <x.icon className="h-5 w-5 text-primary" />
                <div className="mt-2 font-medium">{x.t}</div>
                <div className="text-xs text-muted-foreground">{x.d}</div>
              </Card>
            ))}
          </div>
        </section>

        <AuthCard />
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-muted-foreground">
        Demo prototype. No real funds are moved. Returns are framed as profit-and-loss sharing (musharakah).
      </footer>
    </div>
  );
}

function AuthCard() {
  return (
    <Card className="p-6">
      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin"><SignInForm /></TabsContent>
        <TabsContent value="signup"><SignUpForm /></TabsContent>
      </Tabs>
      <DemoLogins />
    </Card>
  );
}

function SignInForm() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form className="mt-4 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) toast.error(error.message); else toast.success("Welcome back");
    }}>
      <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState<"sme" | "investor">("sme");
  const [loading, setLoading] = useState(false);
  return (
    <form className="mt-4 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, role }, emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (error) toast.error(error.message); else toast.success("Account created");
    }}>
      <div><Label>Full name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
      <div>
        <Label>I am a…</Label>
        <Select value={role} onValueChange={(v) => setRole(v as "sme" | "investor")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sme">SME seeking capital</SelectItem>
            <SelectItem value="investor">Investor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
    </form>
  );
}

function DemoLogins() {
  async function login(email: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: "demo1234" });
    if (error) toast.error("Run 'Seed demo data' first"); else toast.success(`Signed in as ${email}`);
  }
  return (
    <div className="mt-6 border-t pt-4">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Quick demo logins</div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => login("sme@demo.app")}>SME</Button>
        <Button variant="secondary" size="sm" onClick={() => login("investor@demo.app")}>Investor</Button>
        <Button variant="secondary" size="sm" onClick={() => login("admin@demo.app")}>Admin</Button>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">Password for all demo accounts: demo1234</div>
    </div>
  );
}
