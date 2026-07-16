import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEvent,
});

function NewEvent() {
  const { user, role, loading, isApprovedOrganizer } = useAuth();
  const navigate = useNavigate();
  if (!loading && role === "organizer" && !isApprovedOrganizer) return <Navigate to="/verification" />;
  if (!loading && role !== "organizer") return <Navigate to="/dashboard" />;
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    start_at: "",
    end_at: "",
    location: "",
    capacity: 20,
    instructions: "",
    required_items: "",
    service_hours: 2,
    registration_deadline: "",
  });

  const create = useMutation({
    mutationFn: async (publish: boolean) => {
      const { error, data } = await supabase.from("events").insert({
        organizer_id: user!.id,
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        location: form.location || null,
        capacity: Number(form.capacity),
        instructions: form.instructions || null,
        required_items: form.required_items || null,
        service_hours: Number(form.service_hours),
        registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
        status: publish ? "published" : "draft",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Event created");
      navigate({ to: "/events" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (role !== "organizer") return <Navigate to="/dashboard" />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
      <p className="mt-1 text-muted-foreground">Set up the details volunteers need to know.</p>

      <Card className="mt-6 p-6 shadow-card border-border/60">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(true); }}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={set("title")} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={set("category")} placeholder="Environment, Education..." />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={set("location")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set("description")} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Starts at</Label>
              <Input type="datetime-local" value={form.start_at} onChange={set("start_at")} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ends at</Label>
              <Input type="datetime-local" value={form.end_at} onChange={set("end_at")} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" min={0} value={form.capacity} onChange={set("capacity")} />
            </div>
            <div className="space-y-1.5">
              <Label>Service hours</Label>
              <Input type="number" step="0.5" min={0} value={form.service_hours} onChange={set("service_hours")} />
            </div>
            <div className="space-y-1.5">
              <Label>Reg. deadline</Label>
              <Input type="datetime-local" value={form.registration_deadline} onChange={set("registration_deadline")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Volunteer instructions</Label>
            <Textarea value={form.instructions} onChange={set("instructions")} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Required items</Label>
            <Input value={form.required_items} onChange={set("required_items")} placeholder="Water bottle, gloves..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="gradient-primary text-white border-0 hover:opacity-90" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publish event
            </Button>
            <Button type="button" variant="outline" onClick={() => create.mutate(false)} disabled={create.isPending}>
              Save as draft
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
