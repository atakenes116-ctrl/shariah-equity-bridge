import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { RequireRole, DesktopShell } from "@/components/AppShell";

export const Route = createFileRoute("/sme")({ component: SmeLayout });

function SmeLayout() {
  return (
    <RequireRole role="sme">
      <DesktopShell title="SME workspace">
        <nav className="mb-6 flex gap-2 text-sm">
          <Link to="/sme/status" className="rounded-md px-3 py-1.5 hover:bg-accent" activeProps={{ className: "bg-primary text-primary-foreground" }}>My application</Link>
          <Link to="/sme/apply" className="rounded-md px-3 py-1.5 hover:bg-accent" activeProps={{ className: "bg-primary text-primary-foreground" }}>New application</Link>
        </nav>
        <Outlet />
      </DesktopShell>
    </RequireRole>
  );
}