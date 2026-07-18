import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, X, Ban, Trash2, MessageSquare, ShieldQuestion, ShieldCheck, ShieldAlert, ShieldX, Search, Award } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type OrgStatus = Database["public"]["Enums"]["organizer_status"];

export const Route = createFileRoute("/_authenticated/admin/organizers")({
  component: AdminOrganizers,
});

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  more_info: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

function AdminOrganizers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "organizer");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const [{ data: profs }, { data: events }, { data: certs }, { data: regs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, organization_name, organizer_status, suspended, created_at").in("id", ids),
        supabase.from("events").select("id, organizer_id, service_hours, end_at, status"),
        supabase.from("certificates").select("id, organizer_id, certificate_type"),
        supabase.from("event_registrations").select("id, event_id, status"),
      ]);
      const eventsByOrg = new Map<string, { id: string; hours: number; completed: boolean }[]>();
      (events ?? []).forEach((e) => {
        const arr = eventsByOrg.get(e.organizer_id) ?? [];
        arr.push({ id: e.id, hours: Number(e.service_hours ?? 0), completed: e.status === "published" && new Date(e.end_at).getTime() < Date.now() });
        eventsByOrg.set(e.organizer_id, arr);
      });
      const attendedByEvent = new Map<string, number>();
      (regs ?? []).forEach((r) => { if (r.status === "attended") attendedByEvent.set(r.event_id, (attendedByEvent.get(r.event_id) ?? 0) + 1); });
      const eventCount = new Map<string, number>();
      (events ?? []).forEach((e) => eventCount.set(e.organizer_id, (eventCount.get(e.organizer_id) ?? 0) + 1));
      const certCount = new Map<string, number>();
      const hasOrgCert = new Map<string, boolean>();
      (certs ?? []).forEach((c) => {
        certCount.set(c.organizer_id, (certCount.get(c.organizer_id) ?? 0) + 1);
        if (c.certificate_type === "organizer") hasOrgCert.set(c.organizer_id, true);
      });
      return (profs ?? []).map((p) => {
        const evs = eventsByOrg.get(p.id) ?? [];
        const completedEvents = evs.filter((e) => e.completed);
        const managedVolunteers = completedEvents.reduce((s, e) => s + (attendedByEvent.get(e.id) ?? 0), 0);
        const totalHours = completedEvents.reduce((s, e) => s + e.hours * (attendedByEvent.get(e.id) ?? 0), 0);
        return {
          ...p,
          events: eventCount.get(p.id) ?? 0,
          certs: certCount.get(p.id) ?? 0,
          eligibleForCert: completedEvents.length > 0 && managedVolunteers > 0,
          hasOrgCert: !!hasOrgCert.get(p.id),
          managedVolunteers,
          totalHours,
        };
      });

    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-orgs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["admin-organizers"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => qc.invalidateQueries({ queryKey: ["admin-organizers"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrgStatus }) => {
      const { error } = await supabase.from("profiles").update({ organizer_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-organizers"] });
      toast.success(`Status updated to ${v.status}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      // remove role + profile row; auth user deletion requires admin API — leave that to platform admin
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id);
      if (error) throw error;
      const { error: pErr } = await supabase.from("profiles").delete().eq("id", id);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizers"] });
      toast.success("Organizer removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const issueOrgCert = useMutation({
    mutationFn: async (o: { id: string; hours: number; volunteers: number; firstEventId?: string }) => {
      // Pick any of the organizer's completed events for FK; fall back to any event of theirs.
      let eventId = o.firstEventId;
      if (!eventId) {
        const { data: ev } = await supabase.from("events").select("id").eq("organizer_id", o.id).limit(1).maybeSingle();
        eventId = ev?.id;
      }
      if (!eventId) throw new Error("Organizer has no events yet.");
      const code = `ORG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { error } = await supabase.from("certificates").insert({
        certificate_code: code,
        event_id: eventId,
        organizer_id: o.id,
        volunteer_id: o.id,
        service_hours: o.hours,
        certificate_type: "organizer",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-organizers"] });
      toast.success("Organizer certificate issued");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  const filtered = data.filter((o) => {
    const q = search.toLowerCase();
    return !q || o.full_name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) || o.organization_name?.toLowerCase().includes(q);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizer Management</h1>
          <p className="text-sm text-muted-foreground">{data.length} total · {data.filter((o) => o.organizer_status === "pending").length} pending</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search organizers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-border/60"><p className="text-muted-foreground">No organizers found.</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <Card key={o.id} className="p-5 border-border/60 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{o.full_name ?? "Unnamed"}</p>
                    <Badge variant="outline" className={statusColors[o.organizer_status ?? "approved"] ?? ""}>
                      {o.organizer_status ?? "approved"}
                    </Badge>
                    {o.suspended && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">suspended</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{o.email}</p>
                  {o.organization_name && <p className="text-sm mt-1">{o.organization_name}</p>}
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>Joined {format(new Date(o.created_at), "PP")}</span>
                    <span>· {o.events} events</span>
                    <span>· {o.certs} certificates</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/admin/chat/$organizerId" params={{ organizerId: o.id }}>
                    <Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat</Button>
                  </Link>
                  {o.organizer_status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus.mutate({ id: o.id, status: "approved" })} className="gradient-primary text-white border-0">
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {o.organizer_status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: "more_info" })}>
                      <ShieldQuestion className="h-3.5 w-3.5 mr-1" /> Request info
                    </Button>
                  )}
                  {o.organizer_status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: "rejected" })}>
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  )}
                  {o.organizer_status !== "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: "suspended" })}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                    if (confirm(`Delete organizer ${o.full_name ?? o.email}? This removes their role and profile.`)) del.mutate(o.id);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
