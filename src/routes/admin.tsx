import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { RequireRole, DesktopShell } from "@/components/AppShell";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  return (
    <RequireRole role="admin">
      <DesktopShell title="Admin console">
        <nav className="mb-6 flex gap-2 text-sm">
          <Link to="/admin" className="rounded-md px-3 py-1.5 hover:bg-accent" activeOptions={{ exact: true }} activeProps={{ className: "bg-primary text-primary-foreground" }}>Review queue</Link>
          <Link to="/admin/disputes" className="rounded-md px-3 py-1.5 hover:bg-accent" activeProps={{ className: "bg-primary text-primary-foreground" }}>Disputes</Link>
        </nav>
        <Outlet />
      </DesktopShell>
    </RequireRole>
  );
}