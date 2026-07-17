import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, UserCog, Calendar, Award, Clock, AlertCircle, Loader2, TrendingUp,
  MessageSquare, Bell, BarChart3, FileText, ShieldCheck, User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

type AdminPath =
  | "/admin" | "/admin/organizers" | "/admin/volunteers" | "/admin/events"
  | "/admin/certificates" | "/messages" | "/notifications" | "/profile";

function StatCard({ icon: Icon, label, value, delay = 0, to }: { icon: React.ElementType; label: string; value: string | number; delay?: number; to?: AdminPath }) {
  const inner = (
    <Card className="p-5 shadow-card border-border/60 hover:shadow-glow hover:border-primary/50 transition-all cursor-pointer h-full">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-primary shadow-glow">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Card>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      {to ? <Link to={to}>{inner}</Link> : inner}
    </motion.div>
  );
}

function ActionCard({ icon: Icon, label, description, to, delay = 0 }: { icon: React.ElementType; label: string; description: string; to: AdminPath; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <Link to={to}>
        <Card className="p-5 h-full shadow-card border-border/60 hover:shadow-glow hover:border-primary/50 transition-all cursor-pointer group">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-hover:gradient-primary group-hover:text-white transition-all">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

function AdminOverview() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [rolesRes, orgProfilesRes, eventsRes, certsRes, regsRes] = await Promise.all([
        supabase.from("user_roles").select("role"),
        supabase.from("profiles").select("id, organizer_status"),
        supabase.from("events").select("id, status, service_hours, end_at"),
        supabase.from("certificates").select("id, service_hours"),
        supabase.from("event_registrations").select("id, status"),
      ]);
      const roles = rolesRes.data ?? [];
      const orgProfiles = orgProfilesRes.data ?? [];
      const events = eventsRes.data ?? [];
      const certs = certsRes.data ?? [];
      const regs = regsRes.data ?? [];
      const now = Date.now();
      return {
        volunteers: roles.filter((r) => r.role === "volunteer").length,
        organizers: roles.filter((r) => r.role === "organizer").length,
        pending: orgProfiles.filter((p) => p.organizer_status === "pending").length,
        activeEvents: events.filter((e) => e.status === "published" && new Date(e.end_at).getTime() >= now).length,
        pendingEvents: events.filter((e) => e.status === "draft").length,
        completedEvents: events.filter((e) => new Date(e.end_at).getTime() < now).length,
        certificates: certs.length,
        hours: certs.reduce((s, c) => s + Number(c.service_hours ?? 0), 0),
        registrations: regs.length,
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-overview-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide statistics and controls.</p>
      </motion.div>

      {data.pending > 0 && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{data.pending}</span> organizer{data.pending > 1 ? "s" : ""} awaiting approval —{" "}
              <Link to="/admin/organizers" className="text-primary hover:underline font-medium">
                review now
              </Link>
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={AlertCircle} label="Pending Organizers" value={data.pending} delay={0} to="/admin/organizers" />
        <StatCard icon={UserCog} label="Total Organizers" value={data.organizers} delay={0.05} to="/admin/organizers" />
        <StatCard icon={Users} label="Total Volunteers" value={data.volunteers} delay={0.1} to="/admin/volunteers" />
        <StatCard icon={Calendar} label="Active Events" value={data.activeEvents} delay={0.15} to="/admin/events" />
        <StatCard icon={FileText} label="Pending Events" value={data.pendingEvents} delay={0.2} to="/admin/events" />
        <StatCard icon={TrendingUp} label="Completed Events" value={data.completedEvents} delay={0.25} to="/admin/events" />
        <StatCard icon={Award} label="Certificates Issued" value={data.certificates} delay={0.3} to="/admin/certificates" />
        <StatCard icon={Clock} label="Total Service Hours" value={data.hours.toFixed(1)} delay={0.35} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <ActionCard icon={AlertCircle} label="Organizer Requests" description="Review and approve new organizers" to="/admin/organizers" delay={0} />
          <ActionCard icon={UserCog} label="Organizer Management" description="Manage all organizer accounts" to="/admin/organizers" delay={0.05} />
          <ActionCard icon={Users} label="Volunteer Management" description="View and manage volunteers" to="/admin/volunteers" delay={0.1} />
          <ActionCard icon={Calendar} label="Event Approval" description="Review and moderate events" to="/admin/events" delay={0.15} />
          <ActionCard icon={Award} label="Certificate Management" description="Oversee issued certificates" to="/admin/certificates" delay={0.2} />
          <ActionCard icon={ShieldCheck} label="Verification Chat" description="Chat privately with pending organizers" to="/admin/organizers" delay={0.25} />
          <ActionCard icon={MessageSquare} label="Messages" description="System-wide messages" to="/messages" delay={0.3} />
          <ActionCard icon={Bell} label="Notifications" description="Latest platform alerts" to="/notifications" delay={0.35} />
          <ActionCard icon={BarChart3} label="Reports & Analytics" description="Engagement and impact metrics" to="/admin/events" delay={0.4} />
          <ActionCard icon={UserIcon} label="Profile & Settings" description="Update your admin profile" to="/profile" delay={0.45} />
        </div>
      </div>
    </div>
  );
}
