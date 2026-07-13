import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        .select("*, event_registrations(id, volunteer_id, status, registered_at, profiles:profiles!event_registrations_volunteer_id_fkey(full_name, student_id, department))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

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

  if (isLoading || !event) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const isOrganizer = role === "organizer" && event.organizer_id === user?.id;
  const roster = (event.event_registrations ?? []).filter((r) => r.status !== "cancelled");

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
          <h2 className="text-lg font-semibold">Roster ({roster.length})</h2>
          <div className="mt-4 space-y-2">
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No registrations yet.</p>
            ) : (
              roster.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <p className="font-medium text-sm">{r.profiles?.full_name ?? "Volunteer"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.profiles?.department ?? "—"} · registered {format(new Date(r.registered_at), "PP")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "attended" ? (
                      <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => verify.mutate({ regId: r.id, attended: true })}>
                        Mark attended
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
