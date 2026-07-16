import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Send, Megaphone, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { askEventAI } from "@/lib/ai-event-chat.functions";

type Msg = {
  id: string;
  event_id: string;
  sender_id: string;
  body: string;
  is_announcement: boolean;
  created_at: string;
  read_by: unknown;
};

export function EventChat({ eventId, eventTitle, isOrganizer }: { eventId: string; eventTitle: string; isOrganizer: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["event-messages", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, event_id, sender_id, body, is_announcement, created_at, read_by")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["msg-profiles", eventId, senderIds.join(",")],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
      return data ?? [];
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "User";

  useEffect(() => {
    const ch = supabase
      .channel(`event-chat-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["event-messages", eventId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages as read
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const uid = user.id;
    const unread = messages.filter((m) => {
      if (m.sender_id === uid) return false;
      const arr = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
      return !arr.includes(uid);
    });
    if (unread.length === 0) return;
    (async () => {
      for (const m of unread) {
        const arr = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
        await supabase.from("messages").update({ read_by: [...arr, uid] }).eq("id", m.id);
      }
      qc.invalidateQueries({ queryKey: ["unread-messages", uid] });
    })();
  }, [messages, user, qc]);

  const send = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      event_id: eventId,
      sender_id: user.id,
      body: body.trim(),
      is_announcement: isOrganizer && announce,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    setAnnounce(false);
  };

  return (
    <Card className="p-4 border-border/60 shadow-card">
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          {!isOrganizer && <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" /> Ask AI</TabsTrigger>}
        </TabsList>
        <TabsContent value="chat" className="mt-3">
          <div ref={listRef} className="h-72 overflow-y-auto space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "gradient-primary text-white" : "bg-background border border-border/60"}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium opacity-80">{mine ? "You" : nameOf(m.sender_id)}</span>
                        {m.is_announcement && <Badge variant="secondary" className="h-4 text-[10px] gap-1"><Megaphone className="h-2.5 w-2.5" />Announcement</Badge>}
                      </div>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-3 space-y-2">
            <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={isOrganizer ? "Message volunteers…" : "Message the organizer…"} />
            <div className="flex items-center justify-between gap-2">
              {isOrganizer ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} className="accent-primary" />
                  Send as announcement (notify all volunteers)
                </label>
              ) : <span />}
              <Button size="sm" onClick={send} disabled={sending || !body.trim()} className="gradient-primary text-white border-0 hover:opacity-90">
                <Send className="h-3.5 w-3.5 mr-1" /> Send
              </Button>
            </div>
          </div>
        </TabsContent>
        {!isOrganizer && (
          <TabsContent value="ai" className="mt-3">
            <AIChat eventId={eventId} eventTitle={eventTitle} />
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}

function AIChat({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const ask = useServerFn(askEventAI);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const send = async () => {
    if (!q.trim()) return;
    const question = q.trim();
    setQ("");
    setBusy(true);
    try {
      const res = await ask({ data: { eventId, question } });
      setHistory((h) => [...h, { q: question, a: res.answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Ask anything about “{eventTitle}”. Answers are based on the event details.</p>
      <div className="h-64 overflow-y-auto space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Try “What should I bring?” or “When does it start?”</p>
        ) : history.map((h, i) => (
          <div key={i} className="space-y-1">
            <div className="text-sm"><span className="font-medium">You: </span>{h.q}</div>
            <div className="text-sm rounded-md bg-background border border-border/60 p-2 whitespace-pre-wrap">{h.a}</div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this event…" />
        <Button onClick={send} disabled={busy || !q.trim()} className="gradient-primary text-white border-0 hover:opacity-90">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
