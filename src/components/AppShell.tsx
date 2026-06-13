import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth, type Role } from "@/lib/auth";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut } from "lucide-react";

export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    if (!profile) return;
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(profile.role)) {
      navigate({ to: profile.role === "investor" ? "/investor" : profile.role === "admin" ? "/admin" : "/sme/status" });
    }
  }, [loading, profile, user, role, navigate]);
  if (loading || !profile) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}

export function DesktopShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" /></div>
            <span className="font-semibold">Halal Capital</span>
            <span className="ml-3 text-sm text-muted-foreground">{title}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{profile?.name} · {profile?.role}</span>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}