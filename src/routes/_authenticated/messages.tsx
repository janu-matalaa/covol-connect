import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { EventChat } from "@/components/event-chat";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type EventLite = { id: string; title: string; start_at: string };

function MessagesPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<EventLite | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["my-events-for-chat", user?.id, role],
    enabled: !!user && !!role,
    queryFn: async () => {
      if (role === "organizer") {
        const { data } = await supabase
          .from("events")
          .select("id, title, start_at")
          .eq("organizer_id", user!.id)
          .order("start_at", { ascending: false });
        return (data ?? []) as EventLite[];
      }
      const { data } = await supabase
        .from("event_registrations")
        .select("events(id, title, start_at)")
        .eq("volunteer_id", user!.id)
        .neq("status", "cancelled");
      return (data ?? []).map((r) => r.events).filter(Boolean) as EventLite[];
    },
  });

  useEffect(() => {
    if (!selected && events.length > 0) setSelected(events[0]);
  }, [events, selected]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`messages-hub-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["unread-messages", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-muted-foreground">
          {role === "organizer" ? "Talk to volunteers and send announcements." : "Chat with organizers or ask the AI about an event."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <Card className="p-16 text-center border-border/60 shadow-card">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">
            {role === "organizer" ? "Create an event first." : <>Register for an event to start chatting. <Link to="/events" className="text-primary hover:underline">Browse events</Link>.</>}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Card className="p-2 border-border/60 shadow-card h-fit">
            <div className="max-h-[70vh] overflow-y-auto space-y-1">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${selected?.id === e.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(e.start_at), "PP")}</div>
                </button>
              ))}
            </div>
          </Card>
          <div>
            {selected && <EventChat eventId={selected.id} eventTitle={selected.title} isOrganizer={role === "organizer"} />}
          </div>
        </div>
      )}
    </div>
  );
}
