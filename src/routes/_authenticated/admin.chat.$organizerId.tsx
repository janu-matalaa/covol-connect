import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Check, X, Ban, ShieldQuestion, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { analyzeOrganizer } from "@/lib/verification-ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminChat } from "@/components/admin-chat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type OrgStatus = Database["public"]["Enums"]["organizer_status"];

export const Route = createFileRoute("/_authenticated/admin/chat/$organizerId")({
  component: AdminChatPage,
});

function AdminChatPage() {
  const { organizerId } = Route.useParams();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["admin-chat-profile", organizerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, organization_name, institution, purpose, faculty_advisor, website, organizer_status")
        .eq("id", organizerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (status: OrgStatus) => {
    const { error } = await supabase.from("profiles").update({ organizer_status: status }).eq("id", organizerId);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${status}`);
    refetch();
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!profile) return <p className="text-muted-foreground">Organizer not found.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link to="/admin/organizers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to organizers
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{profile.full_name ?? "Organizer"}</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>

      <Card className="p-5 border-border/60 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-medium">Status:</span>
          <Badge variant="outline" className="capitalize">{profile.organizer_status ?? "approved"}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Organization: </span>{profile.organization_name || "—"}</div>
          <div><span className="text-muted-foreground">Institution: </span>{profile.institution || "—"}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Purpose: </span>{profile.purpose || "—"}</div>
          <div><span className="text-muted-foreground">Faculty advisor: </span>{profile.faculty_advisor || "—"}</div>
          <div><span className="text-muted-foreground">Website: </span>{profile.website || "—"}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setStatus("approved")} className="gradient-primary text-white border-0">
            <Check className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("more_info")}>
            <ShieldQuestion className="h-3.5 w-3.5 mr-1" /> Request info
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("rejected")}>
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatus("suspended")}>
            <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
          </Button>
        </div>
      </Card>

      <AiAnalysis organizerId={organizerId} />

      <AdminChat organizerId={organizerId} organizerName={profile.full_name ?? undefined} />
    </div>
  );
}

const riskColors: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

function AiAnalysis({ organizerId }: { organizerId: string }) {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeOrganizer);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["verification-reports", organizerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_reports")
        .select("id, trust_score, risk_level, recommendation, reason, created_at")
        .eq("organizer_id", organizerId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = useMutation({
    mutationFn: async () => analyze({ data: { organizerId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-reports", organizerId] });
      toast.success("Analysis complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const latest = reports[0];

  return (
    <Card className="p-5 border-border/60 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Verification Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Advisory only — the final decision is always yours.</p>
        </div>
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending} className="gradient-primary text-white border-0 hover:opacity-90">
          {run.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Analyze
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !latest ? (
        <p className="mt-4 text-sm text-muted-foreground">No analysis yet. Run one to get a trust score and recommendation.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Trust score: {latest.trust_score}/100</Badge>
            <Badge variant="outline" className={riskColors[latest.risk_level] ?? ""}>Risk: {latest.risk_level}</Badge>
            <Badge variant="outline" className="capitalize">Recommends: {latest.recommendation}</Badge>
            <span className="text-xs text-muted-foreground">{format(new Date(latest.created_at), "PPp")}</span>
          </div>
          <p className="text-sm">{latest.reason}</p>
          {reports.length > 1 && (
            <div className="pt-2 border-t border-border/60 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Previous analyses</p>
              {reports.slice(1).map((r) => (
                <p key={r.id} className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "PP")} · {r.trust_score}/100 · {r.risk_level} risk · {r.recommendation}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
