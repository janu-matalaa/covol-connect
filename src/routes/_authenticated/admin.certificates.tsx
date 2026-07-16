import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Ban, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/certificates")({
  component: AdminCertificates,
});

function AdminCertificates() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-certs"],
    queryFn: async () => {
      const { data: certs, error } = await supabase
        .from("certificates")
        .select("id, certificate_code, service_hours, issued_at, event_id, volunteer_id, organizer_id, revoked, revoked_reason")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const list = certs ?? [];
      if (!list.length) return [];
      const eIds = [...new Set(list.map((c) => c.event_id))];
      const pIds = [...new Set([...list.map((c) => c.volunteer_id), ...list.map((c) => c.organizer_id)])];
      const [{ data: events }, { data: profs }] = await Promise.all([
        supabase.from("events").select("id, title").in("id", eIds),
        supabase.from("profiles").select("id, full_name").in("id", pIds),
      ]);
      const eMap = new Map((events ?? []).map((e) => [e.id, e.title]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return list.map((c) => ({
        ...c,
        event_title: eMap.get(c.event_id) ?? "—",
        volunteer_name: pMap.get(c.volunteer_id) ?? "—",
        organizer_name: pMap.get(c.organizer_id) ?? "—",
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-certs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, () => qc.invalidateQueries({ queryKey: ["admin-certs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const revoke = useMutation({
    mutationFn: async ({ id, revoked }: { id: string; revoked: boolean }) => {
      const { error } = await supabase.from("certificates").update({
        revoked,
        revoked_at: revoked ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-certs"] }); toast.success("Updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = data.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.certificate_code.toLowerCase().includes(q) || c.volunteer_name.toLowerCase().includes(q) || c.event_title.toLowerCase().includes(q);
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificate Management</h1>
          <p className="text-sm text-muted-foreground">{data.length} issued</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code, name, event…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-border/60"><p className="text-muted-foreground">No certificates found.</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-5 border-border/60 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-sm">{c.certificate_code}</p>
                    <Badge className="gradient-primary text-white border-0">{c.service_hours}h</Badge>
                    {c.revoked && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">revoked</Badge>}
                  </div>
                  <p className="mt-1 text-sm"><span className="font-medium">{c.volunteer_name}</span> · {c.event_title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    by {c.organizer_name} · issued {format(new Date(c.issued_at), "PP")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => revoke.mutate({ id: c.id, revoked: !c.revoked })}>
                  {c.revoked ? <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Restore</> : <><Ban className="h-3.5 w-3.5 mr-1" /> Revoke</>}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
