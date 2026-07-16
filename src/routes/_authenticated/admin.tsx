import { createFileRoute, Navigate, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Loader2, LayoutDashboard, Users, UserCog, Calendar, Award } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, isAdmin, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || role === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const tabs = [
    { to: "/admin" as const, label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/admin/organizers" as const, label: "Organizers", icon: UserCog },
    { to: "/admin/volunteers" as const, label: "Volunteers", icon: Users },
    { to: "/admin/events" as const, label: "Events", icon: Calendar },
    { to: "/admin/certificates" as const, label: "Certificates", icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to}>
              <Button variant={active ? "secondary" : "ghost"} size="sm" className="gap-2">
                <t.icon className="h-4 w-4" />
                {t.label}
              </Button>
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
