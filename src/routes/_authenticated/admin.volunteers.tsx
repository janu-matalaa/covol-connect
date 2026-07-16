import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ban, RefreshCw, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/volunteers")({
  component: AdminVolunteers,
});

function AdminVolunteers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-volunteers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "volunteer");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const [{ data: profs }, { data: regs }, { data: certs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, student_id, department, suspended").in("id", ids),
        supabase.from("event_registrations").select("volunteer_id, status, event_id, events(service_hours)").in("volunteer_id", ids),
        supabase.from("certificates").select("volunteer_id, service_hours").in("volunteer_id", ids),
      ]);
      const rMap = new Map<string, { joined: number; hours: number }>();
      (regs ?? []).forEach((r) => {
        const cur = rMap.get(r.volunteer_id) ?? { joined: 0, hours: 0 };
        cur.joined += 1;
        if (r.status === "attended") cur.hours += Number(r.events?.service_hours ?? 0);
        rMap.set(r.volunteer_id, cur);
      });
      const cMap = new Map<string, number>();
      (certs ?? []).forEach((c) => cMap.set(c.volunteer_id, (cMap.get(c.volunteer_id) ?? 0) + 1));
      return (profs ?? []).map((p) => ({
        ...p,
        joined: rMap.get(p.id)?.joined ?? 0,
        hours: rMap.get(p.id)?.hours ?? 0,
        certs: cMap.get(p.id) ?? 0,
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-vols-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["admin-volunteers"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, () => qc.invalidateQueries({ queryKey: ["admin-volunteers"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => qc.invalidateQueries({ queryKey: ["admin-volunteers"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const toggleSuspend = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { error } = await supabase.from("profiles").update({ suspended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-volunteers"] }); toast.success("Updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id);
      if (error) throw error;
      const { error: p } = await supabase.from("profiles").delete().eq("id", id);
      if (p) throw p;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-volunteers"] }); toast.success("Volunteer removed"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = data.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.full_name?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q) || v.student_id?.toLowerCase().includes(q);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Volunteer Management</h1>
          <p className="text-sm text-muted-foreground">{data.length} volunteers</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-border/60"><p className="text-muted-foreground">No volunteers found.</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((v) => (
            <Card key={v.id} className="p-5 border-border/60 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{v.full_name ?? "Unnamed"}</p>
                    {v.suspended && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">suspended</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{v.email}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {v.student_id && <span>ID: {v.student_id}</span>}
                    {v.department && <span>· {v.department}</span>}
                    <span>· {v.joined} events</span>
                    <span>· {v.hours.toFixed(1)}h</span>
                    <span>· {v.certs} certs</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleSuspend.mutate({ id: v.id, suspended: !v.suspended })}>
                    {v.suspended ? <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Reinstate</> : <><Ban className="h-3.5 w-3.5 mr-1" /> Suspend</>}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                    if (confirm(`Delete volunteer ${v.full_name ?? v.email}?`)) del.mutate(v.id);
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
