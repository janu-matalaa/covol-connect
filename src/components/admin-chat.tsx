import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Send, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Msg = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  read_by: unknown;
  created_at: string;
};

/**
 * Private verification chat between an organizer and admins.
 * If `threadId` is not provided (organizer viewing own thread), we look it up.
 */
export function AdminChat({
  threadId,
  organizerId,
  organizerName,
}: {
  threadId?: string;
  organizerId?: string;
  organizerName?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Resolve thread id (create if missing for organizer viewing own thread)
  const { data: tId } = useQuery({
    queryKey: ["admin-thread", threadId ?? organizerId ?? user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (threadId) return threadId;
      const orgId = organizerId ?? user!.id;
      const { data: existing } = await supabase
        .from("admin_chat_threads")
        .select("id")
        .eq("organizer_id", orgId)
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase
        .from("admin_chat_threads")
        .insert({ organizer_id: orgId })
        .select("id")
        .single();
      if (error) throw error;
      return created.id;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-chat-messages", tId],
    enabled: !!tId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_chat_messages")
        .select("*")
        .eq("thread_id", tId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-chat-profiles", tId, senderIds.join(",")],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
      return data ?? [];
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "User";

  useEffect(() => {
    if (!tId) return;
    const ch = supabase
      .channel(`admin-chat-${tId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_chat_messages", filter: `thread_id=eq.${tId}` },
        () => qc.invalidateQueries({ queryKey: ["admin-chat-messages", tId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tId, qc]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark received messages as read
  useEffect(() => {
    if (!user || !messages.length) return;
    const uid = user.id;
    const unread = messages.filter((m) => {
      if (m.sender_id === uid) return false;
      const arr = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
      return !arr.includes(uid);
    });
    if (!unread.length) return;
    (async () => {
      for (const m of unread) {
        const arr = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
        await supabase.from("admin_chat_messages").update({ read_by: [...arr, uid] }).eq("id", m.id);
      }
    })();
  }, [messages, user]);

  const send = async () => {
    if (!body.trim() || !user || !tId) return;
    setSending(true);
    const { error } = await supabase.from("admin_chat_messages").insert({
      thread_id: tId,
      sender_id: user.id,
      body: body.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
  };

  return (
    <Card className="p-4 border-border/60 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">
          Private verification chat{organizerName ? ` · ${organizerName}` : ""}
        </p>
      </div>
      <div ref={listRef} className="h-80 overflow-y-auto space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hello and share your verification details.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "gradient-primary text-white" : "bg-background border border-border/60"
                  }`}
                >
                  <div className="text-xs font-medium opacity-80 mb-0.5">{mine ? "You" : nameOf(m.sender_id)}</div>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" />
        <Button
          onClick={send}
          disabled={sending || !body.trim()}
          className="gradient-primary text-white border-0 hover:opacity-90"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}
