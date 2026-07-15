import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegisterDialog } from "@/components/register-dialog";

export const Route = createFileRoute("/_authenticated/events/")({
  component: EventsList,
});

type Filter = "upcoming" | "past" | "all";

function EventsList() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [regTarget, setRegTarget] = useState<{ id: string; title: string } | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, event_registrations(id, volunteer_id, status)")
        .order("start_at", { ascending: true });
      return data ?? [];
    },
  });

  // Realtime: refresh event list on any events/registration change
  useEffect(() => {
    const ch = supabase
      .channel("events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const register = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("event_registrations").insert({ event_id: eventId, volunteer_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registered!");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["volunteer-dash"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (regId: string) => {
      const { error } = await supabase.from("event_registrations").delete().eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration cancelled");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["volunteer-dash"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const now = new Date();
  const filtered = (events ?? [])
    .filter((e) => {
      // Volunteers never see draft/archived events
      if (role === "volunteer") return e.status === "published" || e.status === "cancelled";
      return true;
    })
    .filter((e) => e.title.toLowerCase().includes(search.toLowerCase()) || (e.category ?? "").toLowerCase().includes(search.toLowerCase()))
    .filter((e) => {
      const start = new Date(e.start_at);
      const end = new Date(e.end_at);
      if (filter === "upcoming") return e.status === "published" && start >= now;
      if (filter === "past") return end < now;
      // All: hide drafts for volunteers is already handled above; for organizers show everything
      if (role === "volunteer") return e.status === "published";
      return true;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="mt-1 text-muted-foreground">
            {role === "organizer" ? "Your and other events on the platform." : "Find your next volunteer opportunity."}
          </p>
        </div>
        {role === "organizer" && (
          <Link to="/events/new"><Button className="gradient-primary text-white border-0 hover:opacity-90">Create Event</Button></Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, categories..." className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-border/60 shadow-card">
          <p className="text-muted-foreground">No events found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e, i) => {
            const myReg = e.event_registrations?.find((r) => r.volunteer_id === user?.id);
            const regCount = e.event_registrations?.filter((r) => r.status !== "cancelled").length ?? 0;
            const isFull = e.capacity > 0 && regCount >= e.capacity;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card className="overflow-hidden border-border/60 shadow-card hover:shadow-glow transition-all group h-full flex flex-col">
                  <div className="h-24 gradient-primary" />
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">{e.title}</h3>
                      {e.category && <Badge variant="secondary" className="shrink-0 capitalize">{e.category}</Badge>}
                    </div>
                    {e.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{e.description}</p>}
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{format(new Date(e.start_at), "PPP p")}</div>
                      {e.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{e.location}</div>}
                      <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{regCount}{e.capacity > 0 ? ` / ${e.capacity}` : ""} registered</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="capitalize text-xs">{e.service_hours}h · {e.status}</Badge>
                      {role === "volunteer" && (
                        myReg ? (
                          <Button size="sm" variant="outline" onClick={() => cancel.mutate(myReg.id)} disabled={cancel.isPending}>
                            Cancel
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => register.mutate(e.id)} disabled={register.isPending || isFull} className="gradient-primary text-white border-0 hover:opacity-90">
                            {isFull ? "Full" : "Register"}
                          </Button>
                        )
                      )}
                      {role === "organizer" && e.organizer_id === user?.id && (
                        <Link to="/events/$id" params={{ id: e.id }}>
                          <Button size="sm" variant="outline">Manage</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
