import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Loader2, ArrowLeft, CheckCircle2, Award, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadCSV } from "@/lib/csv";
import { EventChat } from "@/components/event-chat";

export const Route = createFileRoute("/_authenticated/events/$id")({
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_registrations(id, volunteer_id, status, registered_at, full_name, student_id, department, year_of_study, phone, email, college)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const vids = (data.event_registrations ?? []).map((r) => r.volunteer_id);
      const profilesMap: Record<string, { full_name: string | null; department: string | null; student_id: string | null; email: string | null; phone: string | null }> = {};
      const certsMap: Record<string, { id: string; certificate_code: string }> = {};
      if (vids.length) {
        const [{ data: profs }, { data: certs }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, department, student_id, email, phone").in("id", vids),
          supabase.from("certificates").select("id, certificate_code, volunteer_id").eq("event_id", id).in("volunteer_id", vids),
        ]);
        (profs ?? []).forEach((p) => { profilesMap[p.id] = p; });
        (certs ?? []).forEach((c) => { certsMap[c.volunteer_id] = { id: c.id, certificate_code: c.certificate_code }; });
      }
      return { ...data, profilesMap, certsMap };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`event-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations", filter: `event_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `event_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const verify = useMutation({
    mutationFn: async ({ regId, attended }: { regId: string; attended: boolean }) => {
      const { error } = await supabase
        .from("event_registrations")
        .update({ status: attended ? "attended" : "registered" })
        .eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["organizer-dash"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const generateCert = useMutation({
    mutationFn: async (volunteerId: string) => {
      if (!event) return;
      const { error } = await supabase.from("certificates").insert({
        volunteer_id: volunteerId,
        event_id: event.id,
        organizer_id: event.organizer_id,
        service_hours: event.service_hours,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificate generated");
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["organizer-dash"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !event) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const isOrganizer = role === "organizer" && event.organizer_id === user?.id;
  const roster = (event.event_registrations ?? []).filter((r) => r.status !== "cancelled");

  const exportCSV = () => {
    const rows: (string | number | null | undefined)[][] = [
      ["Full Name", "Student ID", "Department", "Year", "Mobile Number", "Email", "College", "Registration Date", "Attendance Status", "Certificate Status", "Service Hours"],
    ];
    for (const r of roster) {
      const p = event.profilesMap[r.volunteer_id];
      const cert = event.certsMap[r.volunteer_id];
      rows.push([
        r.full_name ?? p?.full_name ?? "",
        r.student_id ?? p?.student_id ?? "",
        r.department ?? p?.department ?? "",
        r.year_of_study ?? "",
        r.phone ?? p?.phone ?? "",
        r.email ?? p?.email ?? "",
        r.college ?? "",
        format(new Date(r.registered_at), "yyyy-MM-dd"),
        r.status,
        cert ? `Issued (${cert.certificate_code})` : "Not issued",
        r.status === "attended" ? event.service_hours : 0,
      ]);
    }
    const safe = event.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    downloadCSV(`${safe}_roster.csv`, rows);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <Card className="overflow-hidden border-border/60 shadow-card">
        <div className="h-32 gradient-hero" />
        <div className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                {event.category && <Badge variant="secondary" className="capitalize">{event.category}</Badge>}
                <Badge variant={event.status === "published" ? "default" : "outline"} className="capitalize">{event.status}</Badge>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.title}</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{event.service_hours}h</p>
              <p className="text-xs text-muted-foreground">Service hours</p>
            </div>
          </div>
          {event.description && <p className="mt-4 text-muted-foreground">{event.description}</p>}

          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{format(new Date(event.start_at), "PPP p")}</div>
            {event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.location}</div>}
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{roster.length}{event.capacity > 0 ? ` / ${event.capacity}` : ""} registered</div>
          </div>

          {(event.instructions || event.required_items) && (
            <div className="mt-6 space-y-3 rounded-lg bg-muted/50 p-4">
              {event.instructions && <div><p className="text-sm font-medium">Instructions</p><p className="mt-1 text-sm text-muted-foreground">{event.instructions}</p></div>}
              {event.required_items && <div><p className="text-sm font-medium">Required items</p><p className="mt-1 text-sm text-muted-foreground">{event.required_items}</p></div>}
            </div>
          )}
        </div>
      </Card>

      {isOrganizer && (
        <Card className="p-6 border-border/60 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Roster ({roster.length})</h2>
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={roster.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No registrations yet.</p>
            ) : (
              roster.map((r) => {
                const p = event.profilesMap[r.volunteer_id];
                const cert = event.certsMap[r.volunteer_id];
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 flex-wrap gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{r.full_name ?? p?.full_name ?? "Volunteer"}</p>
                      <p className="text-xs text-muted-foreground">
                        {(r.student_id ?? p?.student_id) ? `${r.student_id ?? p?.student_id} · ` : ""}
                        {r.department ?? p?.department ?? "—"}
                        {r.year_of_study ? ` · ${r.year_of_study}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(r.email ?? p?.email) ?? "no email"}{(r.phone ?? p?.phone) ? ` · ${r.phone ?? p?.phone}` : ""} · registered {format(new Date(r.registered_at), "PP")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === "attended" ? (
                        <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => verify.mutate({ regId: r.id, attended: true })}>
                          Mark attended
                        </Button>
                      )}
                      {r.status === "attended" && (
                        cert ? (
                          <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" /> Certificate issued</Badge>
                        ) : (
                          <Button size="sm" className="gradient-primary text-white border-0 hover:opacity-90" onClick={() => generateCert.mutate(r.volunteer_id)} disabled={generateCert.isPending}>
                            <Award className="h-3.5 w-3.5 mr-1" /> Generate Certificate
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {(isOrganizer || (role === "volunteer" && roster.some((r) => r.volunteer_id === user?.id))) && (
        <EventChat eventId={event.id} eventTitle={event.title} isOrganizer={isOrganizer} />
      )}
    </motion.div>
  );
}
