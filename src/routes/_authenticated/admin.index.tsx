import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, UserCog, Calendar, Award, Clock, AlertCircle, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function StatCard({ icon: Icon, label, value, delay = 0, to }: { icon: React.ElementType; label: string; value: string | number; delay?: number; to?: string }) {
  const inner = (
    <Card className="p-6 shadow-card border-border/60 hover:shadow-glow transition-all cursor-pointer">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg gradient-primary shadow-glow">
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="mt-1 text-muted-foreground">Platform-wide statistics and controls.</p>
      </div>

      {data.pending > 0 && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm">
              <span className="font-semibold">{data.pending}</span> organizer{data.pending > 1 ? "s" : ""} awaiting approval —{" "}
              <Link to="/admin/organizers" className="text-primary hover:underline font-medium">
                review now
              </Link>
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Volunteers" value={data.volunteers} delay={0} to="/admin/volunteers" />
        <StatCard icon={UserCog} label="Organizers" value={data.organizers} delay={0.05} to="/admin/organizers" />
        <StatCard icon={AlertCircle} label="Pending Approvals" value={data.pending} delay={0.1} to="/admin/organizers" />
        <StatCard icon={Calendar} label="Active Events" value={data.activeEvents} delay={0.15} to="/admin/events" />
        <StatCard icon={TrendingUp} label="Completed Events" value={data.completedEvents} delay={0.2} to="/admin/events" />
        <StatCard icon={Award} label="Certificates Issued" value={data.certificates} delay={0.25} to="/admin/certificates" />
        <StatCard icon={Clock} label="Total Service Hours" value={data.hours.toFixed(1)} delay={0.3} />
        <StatCard icon={Users} label="Registrations" value={data.registrations} delay={0.35} />
      </div>
    </div>
  );
}
