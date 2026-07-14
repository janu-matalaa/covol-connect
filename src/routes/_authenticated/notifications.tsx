import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Bell, CheckCircle2, Trash2, Calendar, UserPlus, UserMinus, Users,
  Award, ClipboardCheck, AlertTriangle, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type NType = Database["public"]["Enums"]["notification_type"];

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const iconFor: Record<NType, React.ElementType> = {
  registration_success: CheckCircle2,
  new_event: Calendar,
  event_reminder: Bell,
  attendance_verified: ClipboardCheck,
  certificate_ready: Award,
  event_updated: Info,
  event_cancelled: AlertTriangle,
  new_registration: UserPlus,
  registration_cancelled: UserMinus,
  event_full: Users,
  attendance_submitted: ClipboardCheck,
  certificate_generated: Award,
};

function NotificationsPage() {
  const { user } = useAuth();
  const { data = [], isLoading, unread } = useNotifications();
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("All marked as read"); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("All cleared"); },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-muted-foreground">{unread} unread · {data.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending}>
            Mark all read
          </Button>
          <Button size="sm" variant="outline" onClick={() => clearAll.mutate()} disabled={data.length === 0 || clearAll.isPending}>
            Clear all
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-16 text-center border-border/60 shadow-card"><p className="text-muted-foreground">Loading...</p></Card>
      ) : data.length === 0 ? (
        <Card className="p-16 text-center border-border/60 shadow-card">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">You're all caught up.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((n, i) => {
            const Icon = iconFor[n.type] ?? Bell;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.02 }}>
                <Card className={`p-4 border-border/60 shadow-card transition-all ${!n.read ? "bg-primary/5 border-primary/30" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary shadow-glow">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {n.title}
                            {!n.read && <Badge variant="secondary" className="h-4 text-[10px]">New</Badge>}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{n.description}</p>
                          {n.event_name && <p className="mt-1 text-xs text-primary">{n.event_name}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!n.read && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => markRead.mutate(n.id)} title="Mark read">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(n.id)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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
