import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Check, X, Ban, ShieldQuestion } from "lucide-react";
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

      <AdminChat organizerId={organizerId} organizerName={profile.full_name ?? undefined} />
    </div>
  );
}
