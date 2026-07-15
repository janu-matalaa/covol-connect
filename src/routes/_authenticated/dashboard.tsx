import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, Users, Award, Clock, TrendingUp, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { role, user } = useAuth();
  if (!role || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return role === "organizer" ? <OrganizerDashboard /> : <VolunteerDashboard />;
}

function StatCard({ icon: Icon, label, value, delay = 0, to }: { icon: React.ElementType; label: string; value: string | number; delay?: number; to?: "/certificates" | "/messages" | "/events" }) {
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {to ? <Link to={to}>{inner}</Link> : inner}
    </motion.div>
  );
}

function VolunteerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["volunteer-dash", user!.id],
    queryFn: async () => {
      const [{ data: regs }, { count: certCount }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("id, status, events(id, title, start_at, location, service_hours, status)")
          .eq("volunteer_id", user!.id),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("volunteer_id", user!.id),
      ]);
      const list = regs ?? [];
      const attended = list.filter((r) => r.status === "attended");
      const upcoming = list.filter((r) => r.status === "registered" && r.events && new Date(r.events.start_at) > new Date());
      const hours = attended.reduce((s, r) => s + Number(r.events?.service_hours ?? 0), 0);
      return { total: list.length, attended: attended.length, upcoming, hours, certs: certCount ?? 0 };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`vol-dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `volunteer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["volunteer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `volunteer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["volunteer-dash", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Volunteer Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Track your impact and upcoming events.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/messages"><Button variant="outline" size="sm" className="gap-1"><MessageSquare className="h-4 w-4" /> Messages</Button></Link>
          <Link to="/certificates"><Button size="sm" className="gap-1 gradient-primary text-white border-0 hover:opacity-90"><Award className="h-4 w-4" /> My Certificates</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Service Hours" value={data!.hours.toFixed(1)} delay={0} />
        <StatCard icon={Calendar} label="Registered" value={data!.total} delay={0.05} to="/events" />
        <StatCard icon={TrendingUp} label="Completed" value={data!.attended} delay={0.1} />
        <StatCard icon={Award} label="Certificates" value={data!.certs} delay={0.15} to="/certificates" />
      </div>

      <Card className="p-6 shadow-card border-border/60">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <Link to="/events"><Button variant="ghost" size="sm">Browse all</Button></Link>
        </div>
        <div className="mt-4 space-y-3">
          {data!.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No upcoming events. <Link to="/events" className="text-primary hover:underline">Browse events</Link>.</p>
          ) : (
            data!.upcoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
                <div>
                  <p className="font-medium">{r.events?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.events && format(new Date(r.events.start_at), "PPP p")} · {r.events?.location}
                  </p>
                </div>
                <Badge variant="secondary">Registered</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function OrganizerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["organizer-dash", user!.id],
    queryFn: async () => {
      const [{ data: events }, { count: certCount }] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, status, start_at, service_hours, event_registrations(id, status)")
          .eq("organizer_id", user!.id)
          .order("start_at", { ascending: false }),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organizer_id", user!.id),
      ]);
      const list = events ?? [];
      const published = list.filter((e) => e.status === "published");
      const upcoming = published.filter((e) => new Date(e.start_at) > new Date());
      const registrations = list.flatMap((e) => e.event_registrations ?? []);
      const verified = registrations.filter((r) => r.status === "attended").length;
      const hours = list.reduce((s, e) => s + Number(e.service_hours) * (e.event_registrations?.filter((r) => r.status === "attended").length ?? 0), 0);
      return { total: list.length, upcoming: upcoming.length, published: published.length, registrations: registrations.length, verified, hours, certs: certCount ?? 0, recent: list.slice(0, 5) };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`org-dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `organizer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `organizer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizer Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage your events and volunteers.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/messages"><Button variant="outline" className="gap-1"><MessageSquare className="h-4 w-4" /> Messages</Button></Link>
          <Link to="/events/new"><Button className="gradient-primary text-white border-0 hover:opacity-90">Create Event</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Total Events" value={data!.total} delay={0} to="/events" />
        <StatCard icon={TrendingUp} label="Upcoming" value={data!.upcoming} delay={0.05} to="/events" />
        <StatCard icon={Users} label="Registrations" value={data!.registrations} delay={0.1} />
        <StatCard icon={Award} label="Certificates" value={data!.certs} delay={0.15} />
      </div>

      <Card className="p-6 shadow-card border-border/60">
        <h2 className="text-lg font-semibold">Recent Events</h2>
        <div className="mt-4 space-y-3">
          {data!.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No events yet. <Link to="/events/new" className="text-primary hover:underline">Create your first event</Link>.</p>
          ) : (
            data!.recent.map((e) => (
              <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="flex items-center justify-between rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.start_at), "PPP")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={e.status === "published" ? "default" : "secondary"} className="capitalize">{e.status}</Badge>
                  <Badge variant="outline">{e.event_registrations?.length ?? 0} registered</Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
