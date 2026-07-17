import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar, Users, Award, Clock, TrendingUp, Loader2, MessageSquare,
  Bell, User as UserIcon, Plus, ListChecks, BarChart3, Shield, CheckCircle2, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type NavPath =
  | "/dashboard" | "/events" | "/events/new" | "/certificates" | "/messages"
  | "/notifications" | "/profile" | "/verification" | "/admin-login";

function Dashboard() {
  const { role, user, isAdmin, organizerStatus, suspended } = useAuth();
  if (!role || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (isAdmin) return <Navigate to="/admin" />;
  const pendingBanner =
    role === "organizer" && organizerStatus && organizerStatus !== "approved" ? (
      <Card className="p-4 border-yellow-500/40 bg-yellow-500/10 mb-6">
        <p className="text-sm">
          Your organizer account is <span className="font-semibold capitalize">{organizerStatus}</span>.{" "}
          <Link to="/verification" className="text-primary hover:underline font-medium">
            Complete verification
          </Link>{" "}
          to unlock event creation.
        </p>
      </Card>
    ) : suspended ? (
      <Card className="p-4 border-destructive/40 bg-destructive/10 mb-6">
        <p className="text-sm">Your account is suspended. Contact an admin for assistance.</p>
      </Card>
    ) : null;
  return (
    <div>
      {pendingBanner}
      {role === "organizer" ? <OrganizerDashboard /> : <VolunteerDashboard />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delay = 0, to }: { icon: React.ElementType; label: string; value: string | number; delay?: number; to?: NavPath }) {
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

function ActionCard({ icon: Icon, label, description, to, delay = 0 }: { icon: React.ElementType; label: string; description: string; to: NavPath; delay?: number }) {
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

function WelcomeHeader({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-sm text-muted-foreground">Welcome back,</p>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight truncate">{name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </motion.div>
  );
}

function VolunteerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["volunteer-dash", user!.id],
    queryFn: async () => {
      const [{ data: regs }, { count: certCount }, { data: profile }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("id, status, events(id, title, start_at, location, service_hours, status)")
          .eq("volunteer_id", user!.id),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("volunteer_id", user!.id),
        supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
      ]);
      const list = regs ?? [];
      const attended = list.filter((r) => r.status === "attended");
      const upcoming = list.filter((r) => r.status === "registered" && r.events && new Date(r.events.start_at) > new Date());
      const hours = attended.reduce((s, r) => s + Number(r.events?.service_hours ?? 0), 0);
      return { total: list.length, attended: attended.length, upcoming, hours, certs: certCount ?? 0, name: profile?.full_name ?? user!.email?.split("@")[0] ?? "Volunteer" };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`vol-dash-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `volunteer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["volunteer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `volunteer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["volunteer-dash", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <WelcomeHeader name={data.name} subtitle="Track your impact and upcoming events." />

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Service Hours" value={data.hours.toFixed(1)} delay={0} />
        <StatCard icon={Calendar} label="Registered" value={data.total} delay={0.05} to="/events" />
        <StatCard icon={TrendingUp} label="Completed" value={data.attended} delay={0.1} />
        <StatCard icon={Award} label="Certificates" value={data.certs} delay={0.15} to="/certificates" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <ActionCard icon={Calendar} label="Browse Events" description="Discover upcoming volunteer opportunities" to="/events" delay={0} />
          <ActionCard icon={CheckCircle2} label="Attendance" description="View your event attendance history" to="/events" delay={0.05} />
          <ActionCard icon={Award} label="Certificates" description="Download your service certificates" to="/certificates" delay={0.1} />
          <ActionCard icon={MessageSquare} label="Messages" description="Chats and announcements from organizers" to="/messages" delay={0.15} />
          <ActionCard icon={Bell} label="Notifications" description="Latest updates on your activity" to="/notifications" delay={0.2} />
          <ActionCard icon={UserIcon} label="Profile & Settings" description="Manage your account details" to="/profile" delay={0.25} />
        </div>
      </div>

      <Card className="p-6 shadow-card border-border/60">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <Link to="/events"><Button variant="ghost" size="sm">Browse all</Button></Link>
        </div>
        <div className="mt-4 space-y-3">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No upcoming events. <Link to="/events" className="text-primary hover:underline">Browse events</Link>.</p>
          ) : (
            data.upcoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.events?.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.events && format(new Date(r.events.start_at), "PPP p")} · {r.events?.location}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">Registered</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function OrganizerDashboard() {
  const { user, isApprovedOrganizer } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["organizer-dash", user!.id],
    queryFn: async () => {
      const [{ data: events }, { count: certCount }, { data: profile }] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, status, start_at, service_hours, event_registrations(id, status)")
          .eq("organizer_id", user!.id)
          .order("start_at", { ascending: false }),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("organizer_id", user!.id),
        supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
      ]);
      const list = events ?? [];
      const published = list.filter((e) => e.status === "published");
      const upcoming = published.filter((e) => new Date(e.start_at) > new Date());
      const active = published.filter((e) => new Date(e.start_at) <= new Date() && list.length);
      const registrations = list.flatMap((e) => e.event_registrations ?? []);
      const verified = registrations.filter((r) => r.status === "attended").length;
      return {
        total: list.length,
        upcoming: upcoming.length,
        active: active.length,
        published: published.length,
        registrations: registrations.length,
        verified,
        certs: certCount ?? 0,
        recent: list.slice(0, 5),
        name: profile?.full_name ?? user!.email?.split("@")[0] ?? "Organizer",
      };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`org-dash-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `organizer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `organizer_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["organizer-dash", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <WelcomeHeader name={data.name} subtitle="Manage your events and volunteers." />
        {isApprovedOrganizer && (
          <Link to="/events/new">
            <Button className="gap-1 gradient-primary text-white border-0 hover:opacity-90">
              <Plus className="h-4 w-4" /> Create Event
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Total Events" value={data.total} delay={0} to="/events" />
        <StatCard icon={TrendingUp} label="Upcoming" value={data.upcoming} delay={0.05} to="/events" />
        <StatCard icon={Users} label="Registrations" value={data.registrations} delay={0.1} />
        <StatCard icon={CheckCircle2} label="Attendance Verified" value={data.verified} delay={0.15} />
        <StatCard icon={Award} label="Certificates" value={data.certs} delay={0.2} />
        <StatCard icon={ListChecks} label="Active Events" value={data.active} delay={0.25} to="/events" />
        <StatCard icon={MessageSquare} label="Messages" value="Open" delay={0.3} to="/messages" />
        <StatCard icon={Bell} label="Notifications" value="View" delay={0.35} to="/notifications" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          {isApprovedOrganizer && (
            <ActionCard icon={Plus} label="Create Event" description="Publish a new volunteering event" to="/events/new" delay={0} />
          )}
          <ActionCard icon={Calendar} label="Manage Events" description="Edit, publish, or review your events" to="/events" delay={0.05} />
          <ActionCard icon={Users} label="Participants" description="View registered volunteers per event" to="/events" delay={0.1} />
          <ActionCard icon={CheckCircle2} label="Attendance" description="Verify volunteer attendance" to="/events" delay={0.15} />
          <ActionCard icon={Award} label="Certificates" description="Generate and manage certificates" to="/events" delay={0.2} />
          <ActionCard icon={MessageSquare} label="Messages" description="Chat with your volunteers" to="/messages" delay={0.25} />
          <ActionCard icon={Bell} label="Notifications" description="See recent alerts and updates" to="/notifications" delay={0.3} />
          <ActionCard icon={BarChart3} label="Analytics" description="Track engagement and impact" to="/events" delay={0.35} />
          <ActionCard icon={UserIcon} label="Profile & Settings" description="Update your organizer profile" to="/profile" delay={0.4} />
          <ActionCard icon={Shield} label="Admin Login" description="Shortcut to admin sign-in (auth required)" to="/admin-login" delay={0.45} />
        </div>
      </div>

      <Card className="p-6 shadow-card border-border/60">
        <h2 className="text-lg font-semibold">Recent Events</h2>
        <div className="mt-4 space-y-3">
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No events yet. <Link to="/events/new" className="text-primary hover:underline">Create your first event</Link>.</p>
          ) : (
            data.recent.map((e) => (
              <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.start_at), "PPP")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={e.status === "published" ? "default" : "secondary"} className="capitalize">{e.status}</Badge>
                  <Badge variant="outline" className="hidden sm:inline-flex">{e.event_registrations?.length ?? 0} registered</Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      {/* unused import guard */}
      <span className="hidden"><FileText /></span>
    </div>
  );
}
