import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Archive, Trash2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/events")({
  component: AdminEvents,
});

function AdminEvents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("events")
        .select("id, title, status, start_at, end_at, organizer_id, capacity, event_registrations(id)")
        .order("start_at", { ascending: false });
      if (error) throw error;
      const orgIds = [...new Set((events ?? []).map((e) => e.organizer_id))];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", orgIds);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (events ?? []).map((e) => ({
        ...e,
        organizer_name: nameMap.get(e.organizer_id) ?? "Unknown",
        registrations: e.event_registrations?.length ?? 0,
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-ev-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => qc.invalidateQueries({ queryKey: ["admin-events"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => qc.invalidateQueries({ queryKey: ["admin-events"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-events"] }); toast.success("Event archived"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-events"] }); toast.success("Event deleted"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = data.filter((e) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Management</h1>
          <p className="text-sm text-muted-foreground">{data.length} events across all organizers</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-border/60"><p className="text-muted-foreground">No events found.</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((e) => (
            <Card key={e.id} className="p-5 border-border/60 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{e.title}</p>
                    <Badge variant="outline" className="capitalize">{e.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">by {e.organizer_name}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{format(new Date(e.start_at), "PPP p")}</span>
                    <span>· {e.registrations} / {e.capacity || "∞"} registered</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to="/events/$id" params={{ id: e.id }}>
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open</Button>
                  </Link>
                  {e.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={() => archive.mutate(e.id)}>
                      <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                    if (confirm(`Delete "${e.title}"? This cannot be undone.`)) del.mutate(e.id);
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
