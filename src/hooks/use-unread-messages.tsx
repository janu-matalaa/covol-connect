import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["unread-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, read_by")
        .order("created_at", { ascending: false })
        .limit(500);
      const uid = user!.id;
      return (data ?? []).filter((m) => {
        if (m.sender_id === uid) return false;
        const readers = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
        return !readers.includes(uid);
      }).length;
    },
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`msg-unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["unread-messages", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
  return q.data ?? 0;
}
