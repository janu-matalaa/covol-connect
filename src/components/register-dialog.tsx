import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  student_id: z.string().trim().min(1, "Required").max(50),
  department: z.string().trim().min(1, "Required").max(120),
  year_of_study: z.string().trim().min(1, "Required").max(20),
  phone: z.string().trim().min(6, "Enter a valid mobile number").max(20),
  email: z.string().trim().email("Enter a valid email").max(200),
  college: z.string().trim().max(200).optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

export function RegisterDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventTitle: string;
  onRegistered?: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    full_name: "", student_id: "", department: "", year_of_study: "",
    phone: "", email: "", college: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, student_id, department, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      setForm((f) => ({
        ...f,
        full_name: data?.full_name ?? f.full_name,
        student_id: data?.student_id ?? f.student_id,
        department: data?.department ?? f.department,
        phone: data?.phone ?? f.phone,
        email: data?.email ?? user.email ?? f.email,
      }));
    })();
  }, [open, user]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete all required fields");
      return;
    }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("event_registrations").insert({
      event_id: eventId,
      volunteer_id: user.id,
      full_name: parsed.data.full_name,
      student_id: parsed.data.student_id,
      department: parsed.data.department,
      year_of_study: parsed.data.year_of_study,
      phone: parsed.data.phone,
      email: parsed.data.email,
      college: parsed.data.college || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Registered!");
    onOpenChange(false);
    onRegistered?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register for {eventTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full Name" value={form.full_name} onChange={(v) => set("full_name", v)} required />
          <Field label="Student ID / Roll No." value={form.student_id} onChange={(v) => set("student_id", v)} required />
          <Field label="Department" value={form.department} onChange={(v) => set("department", v)} required />
          <Field label="Year of Study" value={form.year_of_study} onChange={(v) => set("year_of_study", v)} required placeholder="e.g. 2nd Year" />
          <Field label="Mobile Number" value={form.phone} onChange={(v) => set("phone", v)} required />
          <Field label="Email" value={form.email} onChange={(v) => set("email", v)} required type="email" />
          <div className="sm:col-span-2">
            <Field label="College (optional)" value={form.college ?? ""} onChange={(v) => set("college", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gradient-primary text-white border-0 hover:opacity-90">
            {busy ? "Registering..." : "Confirm Registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, required, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} />
    </div>
  );
}
