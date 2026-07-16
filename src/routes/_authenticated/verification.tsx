import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ShieldX, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminChat } from "@/components/admin-chat";

export const Route = createFileRoute("/_authenticated/verification")({
  component: VerificationPage,
});

const statusMeta: Record<string, { label: string; icon: React.ElementType; className: string; note: string }> = {
  pending: { label: "Pending review", icon: ShieldQuestion, className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", note: "Your organizer application is awaiting admin approval." },
  more_info: { label: "More info requested", icon: ShieldAlert, className: "bg-orange-500/15 text-orange-600 border-orange-500/30", note: "An admin has requested more information — please reply in the chat below." },
  approved: { label: "Approved", icon: ShieldCheck, className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", note: "You are verified and have full organizer access." },
  rejected: { label: "Rejected", icon: ShieldX, className: "bg-destructive/15 text-destructive border-destructive/30", note: "Your organizer application was rejected." },
  suspended: { label: "Suspended", icon: ShieldAlert, className: "bg-destructive/15 text-destructive border-destructive/30", note: "Your organizer account is suspended." },
};

function VerificationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    organization_name: "",
    institution: "",
    purpose: "",
    faculty_advisor: "",
    website: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["verification-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("organizer_status, organization_name, institution, purpose, faculty_advisor, website")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        organization_name: profile.organization_name ?? "",
        institution: profile.institution ?? "",
        purpose: profile.purpose ?? "",
        faculty_advisor: profile.faculty_advisor ?? "",
        website: profile.website ?? "",
      });
    }
  }, [profile]);

  const status = (profile?.organizer_status ?? "pending") as keyof typeof statusMeta;
  const meta = statusMeta[status] ?? statusMeta.pending;
  const Icon = meta.icon;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Verification details saved");
    qc.invalidateQueries({ queryKey: ["verification-profile", user?.id] });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizer Verification</h1>
        <p className="mt-1 text-muted-foreground">Complete your details and chat with an admin to get approved.</p>
      </div>

      <Card className={`p-5 border ${meta.className}`}>
        <div className="flex items-start gap-3">
          <Icon className="h-6 w-6 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <Badge variant="outline">{meta.label}</Badge>
            </div>
            <p className="mt-1 text-sm">{meta.note}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-border/60 shadow-card space-y-4">
        <h2 className="font-semibold">Verification details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Organization name</Label>
            <Input value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Institution</Label>
            <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Purpose</Label>
            <Textarea rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Faculty advisor (optional)</Label>
            <Input value={form.faculty_advisor} onChange={(e) => setForm({ ...form, faculty_advisor: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Website / social (optional)</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gradient-primary text-white border-0 hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </Card>

      <AdminChat />
    </div>
  );
}
