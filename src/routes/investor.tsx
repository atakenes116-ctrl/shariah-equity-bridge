import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { RequireRole } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, Store, Briefcase, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/investor")({ component: InvestorLayout });

function InvestorLayout() {
  return (
    <RequireRole role="investor">
      <Shell />
    </RequireRole>
  );
}

function Shell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tab = (p: string) => pathname === p || pathname.startsWith(p + "/") || (p === "/investor" && pathname === "/investor");
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-semibold leading-tight">Halal Capital</div>
              <div className="text-[11px] text-muted-foreground leading-tight">€{Math.round(profile?.wallet_balance ?? 0).toLocaleString()} available</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4"><Outlet /></main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card">
        <div className="mx-auto grid max-w-md grid-cols-2">
          <Link to="/investor" className={`flex flex-col items-center gap-1 py-3 text-xs ${tab("/investor") && !pathname.startsWith("/investor/portfolio") ? "text-primary" : "text-muted-foreground"}`}>
            <Store className="h-5 w-5" /> Marketplace
          </Link>
          <Link to="/investor/portfolio" className={`flex flex-col items-center gap-1 py-3 text-xs ${pathname.startsWith("/investor/portfolio") ? "text-primary" : "text-muted-foreground"}`}>
            <Briefcase className="h-5 w-5" /> My investments
          </Link>
        </div>
      </nav>
    </div>
  );
}