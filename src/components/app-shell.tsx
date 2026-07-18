import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, LayoutDashboard, Calendar, User as UserIcon, LogOut, Plus, Award, MessageSquare, Shield, ShieldCheck, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, isAdmin, isApprovedOrganizer, organizerStatus, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isPendingOrganizer = role === "organizer" && organizerStatus && organizerStatus !== "approved";

  const navItems = isAdmin
    ? [
        { to: "/admin" as const, label: "Dashboard", icon: Shield },
        { to: "/events" as const, label: "Events", icon: Calendar },
        { to: "/messages" as const, label: "Messages", icon: MessageSquare },
        { to: "/notifications" as const, label: "Alerts", icon: Bell },
      ]
    : [
        { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
        { to: "/events" as const, label: "Events", icon: Calendar },
        { to: "/messages" as const, label: "Messages", icon: MessageSquare },
        ...(role === "volunteer" || role === "organizer" ? [{ to: "/certificates" as const, label: "Certificates", icon: Award }] : []),
        ...(isPendingOrganizer ? [{ to: "/verification" as const, label: "Verification", icon: ShieldCheck }] : []),
      ];

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 glass">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CoVol</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}>
                  <Button variant={active ? "secondary" : "ghost"} size="sm" className="gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isApprovedOrganizer && (
              <Link to="/events/new" className="hidden sm:block">
                <Button size="sm" className="gap-1 gradient-primary text-white border-0 hover:opacity-90">
                  <Plus className="h-4 w-4" /> New Event
                </Button>
              </Link>
            )}
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="gradient-primary text-white text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm">{user?.email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{role ?? "loading..."}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="container mx-auto px-4 py-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
