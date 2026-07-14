import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, Download, Eye, FileImage, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { CertificateView, type CertificateData } from "@/components/certificate-view";

export const Route = createFileRoute("/_authenticated/certificates")({
  component: CertificatesPage,
});

type Cert = {
  id: string;
  certificate_code: string;
  service_hours: number;
  issued_at: string;
  event_id: string;
  organizer_id: string;
  event_title: string;
  volunteer_name: string;
  organizer_name: string;
};

function CertificatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Cert | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["certificates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: certs, error } = await supabase
        .from("certificates")
        .select("id, certificate_code, service_hours, issued_at, event_id, organizer_id, volunteer_id")
        .eq("volunteer_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const list = certs ?? [];
      if (list.length === 0) return [] as Cert[];
      const eventIds = [...new Set(list.map((c) => c.event_id))];
      const profIds = [...new Set([...list.map((c) => c.organizer_id), user!.id])];
      const [{ data: events }, { data: profs }] = await Promise.all([
        supabase.from("events").select("id, title").in("id", eventIds),
        supabase.from("profiles").select("id, full_name").in("id", profIds),
      ]);
      const eMap = new Map((events ?? []).map((e) => [e.id, e.title]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return list.map<Cert>((c) => ({
        id: c.id,
        certificate_code: c.certificate_code,
        service_hours: Number(c.service_hours),
        issued_at: c.issued_at,
        event_id: c.event_id,
        organizer_id: c.organizer_id,
        event_title: eMap.get(c.event_id) ?? "Event",
        volunteer_name: pMap.get(user!.id) ?? "Volunteer",
        organizer_name: pMap.get(c.organizer_id) ?? "Organizer",
      }));
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`certs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `volunteer_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["certificates", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const toData = (c: Cert): CertificateData => ({
    code: c.certificate_code,
    volunteerName: c.volunteer_name,
    eventName: c.event_title,
    organizerName: c.organizer_name,
    serviceHours: c.service_hours,
    issuedAt: c.issued_at,
  });

  const downloadPNG = async (c: Cert) => {
    if (!ref.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${c.certificate_code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Unable to render certificate");
    }
  };

  const downloadPDF = () => window.print();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
        <p className="mt-1 text-muted-foreground">Your service certificates from CoVol.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : data.length === 0 ? (
        <Card className="p-16 text-center border-border/60 shadow-card">
          <Award className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No certificates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Attend events and wait for the organizer to issue your certificate.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <Card className="p-6 border-border/60 shadow-card hover:shadow-glow transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.event_title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">by {c.organizer_name}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{c.certificate_code}</p>
                  </div>
                  <Badge className="gradient-primary text-white border-0">{c.service_hours}h</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Issued {format(new Date(c.issued_at), "PPP")}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(c)}><Eye className="h-3.5 w-3.5 mr-1" /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => { setOpen(c); setTimeout(downloadPDF, 300); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => { setOpen(c); setTimeout(() => downloadPNG(c), 300); }}><FileImage className="h-3.5 w-3.5 mr-1" /> PNG</Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Certificate</DialogTitle></DialogHeader>
          {open && <CertificateView ref={ref} data={toData(open)} />}
          {open && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => downloadPNG(open)}><FileImage className="h-4 w-4 mr-1" /> PNG</Button>
              <Button variant="outline" onClick={downloadPDF}><Download className="h-4 w-4 mr-1" /> PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
